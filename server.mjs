import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPT_A, PROMPT_B, FORMAT_PROMPT, PROBLEM_SCHEMA, EVAL_TASKS, RUBRIC, JUDGE_SCHEMA, JUDGE_INSTRUCTIONS, CHAT_INSTRUCTIONS } from './lib/config.mjs';
import { gradeDeterministically, summarizeGrades } from './lib/evaluation.mjs';
import { requestStructured, requestText } from './lib/openai.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadEnv();

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const basePath = `/${String(process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const accessToken = process.env.APP_ACCESS_TOKEN || '';
const apiKey = process.env.OPENAI_API_KEY || '';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !accessToken) {
  throw new Error('Set APP_ACCESS_TOKEN before listening on a non-local address.');
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) { reject(new Error('Request is too large.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    req.on('error', reject);
  });
}

function validModel(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/.test(value);
}

function protectedRoute(req, res) {
  if (!accessToken) return true;
  if (req.headers['x-app-token'] === accessToken) return true;
  json(res, 401, { error: 'Enter the app access token in Admin.' });
  return false;
}

async function handleGenerate(req, res) {
  if (!protectedRoute(req, res)) return;
  if (!apiKey) return json(res, 503, { error: 'Add OPENAI_API_KEY to .env and restart the server. The demo preview works without a key.' });
  const body = await readJson(req);
  const model = body.model || 'gpt-6-sol';
  const systemPrompt = body.systemPrompt;
  const task = EVAL_TASKS.find((item) => item.id === body.taskId);
  const userInput = task ? task.input : body.userInput;
  if (!validModel(model)) return json(res, 400, { error: 'Enter a valid model ID.' });
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim() || systemPrompt.length > 12_000) return json(res, 400, { error: 'The system prompt is missing or too long.' });
  if (typeof userInput !== 'string' || !userInput.trim() || userInput.length > 3_000) return json(res, 400, { error: 'The request is missing or too long.' });

  const result = await requestStructured({
    key: apiKey,
    model,
    instructions: `${systemPrompt.trim()}\n\nOUTPUT FORMAT\n${FORMAT_PROMPT}`,
    input: userInput,
    schema: PROBLEM_SCHEMA,
    schemaName: 'coding_tutor_exercise'
  });
  json(res, 200, {
    taskId: task?.id || null,
    input: userInput,
    model,
    output: result.data,
    gates: gradeDeterministically(result.data, task || null),
    metrics: result.metrics
  });
}

async function handleJudge(req, res) {
  if (!protectedRoute(req, res)) return;
  if (!apiKey) return json(res, 503, { error: 'Add OPENAI_API_KEY to .env and restart the server.' });
  const body = await readJson(req);
  const task = EVAL_TASKS.find((item) => item.id === body.taskId);
  const model = body.model || 'gpt-6-sol';
  if (!task) return json(res, 400, { error: 'Unknown evaluation task.' });
  if (!validModel(model)) return json(res, 400, { error: 'Enter a valid judge model ID.' });
  if (!body.output || typeof body.output !== 'object') return json(res, 400, { error: 'Missing generated output.' });
  const judge = await requestStructured({
    key: apiKey,
    model,
    instructions: JUDGE_INSTRUCTIONS,
    input: JSON.stringify({ userRequest: task.input, generatedOutput: body.output }),
    schema: JUDGE_SCHEMA,
    schemaName: 'coding_tutor_judgment'
  });
  const gates = gradeDeterministically(body.output, task);
  json(res, 200, {
    taskId: task.id,
    judgeModel: model,
    gates,
    rubric: judge.data,
    summary: summarizeGrades(gates, judge.data),
    metrics: judge.metrics
  });
}

async function handleChat(req, res) {
  if (!protectedRoute(req, res)) return;
  if (!apiKey) return json(res, 503, { error: 'Add OPENAI_API_KEY to .env and restart the server.' });
  const body = await readJson(req);
  const model = body.model || 'gpt-6-sol';
  if (!validModel(model)) return json(res, 400, { error: 'Enter a valid model ID.' });
  if (!body.problem || typeof body.problem !== 'object') return json(res, 400, { error: 'Generate a problem first.' });
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1500) return json(res, 400, { error: 'Write a question under 1,500 characters.' });
  const history = Array.isArray(body.history) ? body.history.slice(-8).filter((item) => ['user', 'assistant'].includes(item?.role) && typeof item.content === 'string').map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })) : [];
  const context = {
    problem: body.problem.problem,
    title: body.problem.title,
    topic: body.problem.topic,
    difficulty: body.problem.difficulty,
    learnerCode: typeof body.learnerCode === 'string' ? body.learnerCode.slice(0, 5000) : '',
    solutionVisible: body.solutionVisible === true
  };
  if (context.solutionVisible) context.solution = body.problem.solution;
  const result = await requestText({
    key: apiKey,
    model,
    instructions: CHAT_INSTRUCTIONS,
    input: [
      { role: 'user', content: `Problem context for this tutoring exchange:\n${JSON.stringify(context)}` },
      ...history,
      { role: 'user', content: body.message.trim() }
    ]
  });
  json(res, 200, { reply: result.text, durationMs: result.durationMs });
}

function serveStatic(route, res) {
  const file = route === '/' ? 'index.html' : route.slice(1);
  if (!['index.html', 'app.js', 'styles.css', 'favicon.svg'].includes(file)) return json(res, 404, { error: 'Not found.' });
  const filename = path.join(root, 'public', file);
  fs.readFile(filename, (error, content) => {
    if (error) return json(res, 404, { error: 'Not found.' });
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)],
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
      res.writeHead(308, { Location: basePath }); return res.end();
    }
    if (!pathname.startsWith(basePath)) return json(res, 404, { error: 'Not found.' });
    const route = `/${pathname.slice(basePath.length)}`;
    if (req.method === 'GET' && route === '/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && route === '/api/config') {
      return json(res, 200, { prompts: { A: PROMPT_A, B: PROMPT_B }, formatPrompt: FORMAT_PROMPT, tasks: EVAL_TASKS, rubric: RUBRIC, defaultModel: 'gpt-6-sol', keyConfigured: Boolean(apiKey), accessTokenRequired: Boolean(accessToken), basePath });
    }
    if (req.method === 'POST' && route === '/api/generate') return await handleGenerate(req, res);
    if (req.method === 'POST' && route === '/api/judge') return await handleJudge(req, res);
    if (req.method === 'POST' && route === '/api/chat') return await handleChat(req, res);
    if (req.method === 'GET') return serveStatic(route, res);
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'The model request timed out.' : (error?.message || 'Unexpected server error.');
    if (!res.headersSent) json(res, 500, { error: message });
  }
});

server.listen(port, host, () => console.log(`Coding Tutor Eval Lab running at http://${host}:${port}${basePath}`));
