const $ = (id) => document.getElementById(id);
const STORAGE_SETTINGS = 'pattern-lab-settings-v1';
const STORAGE_SESSION = 'pattern-lab-session-v1';
const STORAGE_ACCESS = 'pattern-lab-access-token';

const state = {
  config: null,
  settings: null,
  exercise: null,
  exerciseMeta: null,
  chatHistory: [],
  evaluation: null,
  isRunning: false
};

const demoExercise = {
  title: 'Longest Stretch Without Repeats',
  difficulty: 'medium',
  topic: 'sliding window',
  language: 'python',
  problem: {
    description: 'Given a string s, return the length of the longest contiguous substring that contains no repeated characters. A substring consists of characters next to each other in the original string.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The substring "abc" has length 3. Any longer substring repeats a character.' },
      { input: 's = "bbbbb"', output: '1', explanation: 'Only a single "b" can be included without repeating.' },
      { input: 's = ""', output: '0', explanation: 'An empty string has no non-empty substrings.' }
    ],
    constraints: ['0 <= len(s) <= 100000', 's may contain letters, digits, symbols, and spaces.'],
    starterCode: 'class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        # Write your solution here\n        pass'
  },
  solution: {
    intuition: 'Keep a window that contains no repeated character. When a character appears twice, move the left edge forward until the window is valid again.',
    approach: 'Scan the string with a right pointer. Store the most recent index of each character. If the current character appeared inside the active window, move the left pointer just past its previous index. After each step, compare the window length with the best length seen so far.',
    walkthrough: 'For "abcabcbb", the first three characters grow the window to "abc". The next "a" repeats at index 0, so the left edge moves to index 1. The longest valid window remains length 3.',
    correctness: 'After processing each character, the window contains no repeats: when a repeated character is found, moving the left edge past its previous occurrence removes the conflict. Every valid candidate ending at the current position is no longer than this window, so the maximum recorded length is the answer.',
    complexity: 'Time: O(n), because each character is processed once. Space: O(min(n, alphabet size)) for the last-seen map.',
    code: 'class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        last_seen = {}\n        left = 0\n        best = 0\n\n        for right, char in enumerate(s):\n            if char in last_seen and last_seen[char] >= left:\n                left = last_seen[char] + 1\n            last_seen[char] = right\n            best = max(best, right - left + 1)\n\n        return best'
  }
};

function safeJson(raw, fallback) { if (!raw) return fallback; try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } }
function element(tag, className = '', text = '') { const node = document.createElement(tag); if (className) node.className = className; if (text !== '') node.textContent = text; return node; }
function formatMs(ms) { return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`; }
function setMessage(id, message, isError = false) { const node = $(id); node.textContent = message; node.classList.toggle('error', isError); }
function persistSession() { sessionStorage.setItem(STORAGE_SESSION, JSON.stringify({ exercise: state.exercise, exerciseMeta: state.exerciseMeta, chatHistory: state.chatHistory, evaluation: state.evaluation, request: $('request-input').value, draft: $('code-editor').value })); }
function persistSettings() { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings)); updateConfigLabels(); setMessage('settings-message', 'Saved in this browser.'); }

async function api(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': sessionStorage.getItem(STORAGE_ACCESS) || '' },
    body: JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error(`Server returned HTTP ${response.status}.`); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function currentPrompt() { return state.settings.activePrompt === 'B' ? state.settings.promptB : state.settings.promptA; }
function updateConfigLabels() {
  if (!state.settings) return;
  const label = `Prompt ${state.settings.activePrompt} · ${state.settings.model}`;
  $('active-config-label').textContent = label;
  $('eval-prompt-name').textContent = `Prompt ${state.settings.activePrompt}`;
  $('eval-model-name').textContent = state.settings.model;
  $('eval-judge-name').textContent = state.settings.judgeModel;
  $('prompt-a-switch').classList.toggle('active', state.settings.activePrompt === 'A');
  $('prompt-b-switch').classList.toggle('active', state.settings.activePrompt === 'B');
}

function showView(view) {
  const selected = ['practice', 'eval', 'admin'].includes(view) ? view : 'practice';
  document.querySelectorAll('.view').forEach((item) => item.classList.toggle('active', item.id === `${selected}-view`));
  document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.view === selected));
  if (location.hash !== `#${selected}`) history.replaceState(null, '', `#${selected}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateLineNumbers() {
  const editor = $('code-editor');
  $('line-numbers').textContent = Array.from({ length: editor.value.split('\n').length }, (_, i) => i + 1).join('\n');
  $('line-numbers').scrollTop = editor.scrollTop;
}

function toggleSolution(show) {
  const visible = Boolean(show) && Boolean(state.exercise);
  $('solution-card').classList.toggle('hidden', !visible);
  $('workspace-grid').classList.toggle('split', visible);
  $('solution-toggle').innerHTML = visible ? 'Hide solution <span aria-hidden="true">←</span>' : 'Reveal solution <span aria-hidden="true">→</span>';
  $('solution-toggle').setAttribute('aria-expanded', String(visible));
}

function renderExercise(exercise, meta = {}) {
  state.exercise = exercise;
  state.exerciseMeta = meta;
  state.chatHistory = [];
  $('empty-state').classList.add('hidden');
  $('result-section').classList.remove('hidden');
  $('result-title').textContent = exercise.title || 'Untitled problem';
  $('result-difficulty').textContent = exercise.difficulty || 'unknown';
  $('result-topic').textContent = exercise.topic || 'topic unknown';
  $('problem-description').textContent = exercise.problem?.description || '';
  $('examples-list').replaceChildren();
  (exercise.problem?.examples || []).forEach((example, index) => {
    const box = element('div', 'example');
    box.append(element('div', 'example-label', `Example ${index + 1}`));
    box.append(element('p', '', `Input: ${example.input || ''}`));
    box.append(element('p', '', `Output: ${example.output || ''}`));
    box.append(element('p', 'explanation', example.explanation || ''));
    $('examples-list').append(box);
  });
  $('constraints-list').replaceChildren(...(exercise.problem?.constraints || []).map((item) => element('li', '', item)));
  $('code-editor').value = exercise.problem?.starterCode || '';
  updateLineNumbers();
  for (const key of ['intuition', 'approach', 'walkthrough', 'correctness', 'complexity']) $(`solution-${key}`).textContent = exercise.solution?.[key] || '';
  $('solution-code').textContent = exercise.solution?.code || '';
  toggleSolution(false);
  const source = meta.demo ? 'Sample preview · no API request' : `${meta.model || 'Model'} · ${formatMs(meta.metrics?.durationMs)} · ${meta.metrics?.outputCharacters ?? '—'} characters`;
  $('result-meta').textContent = source;
  renderChat();
  persistSession();
  $('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderChat() {
  $('chat-messages').replaceChildren();
  if (!state.chatHistory.length) {
    const welcome = element('div', 'chat-bubble tutor', 'I’m here when you want a hint, a clarification, or feedback on your draft code.');
    $('chat-messages').append(welcome);
  } else {
    state.chatHistory.forEach((entry) => $('chat-messages').append(element('div', `chat-bubble ${entry.role === 'user' ? 'learner' : 'tutor'}`, entry.content)));
  }
  $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
}

async function sendChat() {
  if (state.isRunning || !state.exercise) return;
  const message = $('chat-input').value.trim();
  if (!message) return;
  state.isRunning = true;
  $('chat-send-btn').disabled = true;
  $('chat-input').value = '';
  setMessage('chat-message', 'Tutor is thinking…');
  const history = [...state.chatHistory];
  state.chatHistory.push({ role: 'user', content: message });
  renderChat(); persistSession();
  try {
    const result = await api('api/chat', {
      model: state.settings.model,
      problem: state.exercise,
      learnerCode: $('code-editor').value,
      solutionVisible: !$('solution-card').classList.contains('hidden'),
      history,
      message
    });
    state.chatHistory.push({ role: 'assistant', content: result.reply });
    setMessage('chat-message', `Reply received in ${formatMs(result.durationMs)}.`);
  } catch (error) { setMessage('chat-message', error.message, true); }
  finally { state.isRunning = false; $('chat-send-btn').disabled = false; renderChat(); persistSession(); }
}

async function generatePractice() {
  if (state.isRunning) return;
  const userInput = $('request-input').value.trim();
  if (!userInput) return setMessage('practice-message', 'Write a request first.', true);
  state.isRunning = true;
  $('generate-btn').disabled = true;
  setMessage('practice-message', 'Generating your problem. This may take a moment…');
  try {
    const result = await api('api/generate', { userInput, model: state.settings.model, systemPrompt: currentPrompt() });
    renderExercise(result.output, { model: result.model, metrics: result.metrics, gates: result.gates });
    setMessage('practice-message', 'Problem ready. The solution is closed until you reveal it.');
  } catch (error) { setMessage('practice-message', error.message, true); }
  finally { state.isRunning = false; $('generate-btn').disabled = false; }
}

function renderTasks() {
  $('task-list').replaceChildren();
  state.config.tasks.forEach((task, index) => {
    const row = element('div', 'task-item');
    row.append(element('span', 'task-number', String(index + 1).padStart(2, '0')));
    const detail = element('div');
    detail.append(element('strong', '', task.label));
    detail.append(element('p', '', `“${task.input}”`));
    row.append(detail);
    $('task-list').append(row);
  });
}

function addSummary(label, value) {
  const item = element('div', 'summary-item');
  item.append(element('span', '', label), element('strong', '', value));
  $('eval-summary').append(item);
}

function scoreCard(title, value, note, bad = false) {
  const card = element('div', 'score-card');
  const head = element('div');
  head.append(element('strong', '', title), element('span', `score-value${bad ? ' bad' : ''}`, value));
  card.append(head, element('p', '', note));
  return card;
}

function renderRun(run) {
  const details = element('details', 'run-item');
  const summary = element('summary');
  const task = state.config.tasks.find((item) => item.id === run.taskId);
  summary.append(element('strong', '', `${task?.label || run.taskId} · trial ${run.trial}`));
  const status = run.error ? 'Error' : run.judgment ? (run.judgment.summary?.passed ? 'Pass' : 'Review') : 'Unscored';
  summary.append(element('span', `run-status${status === 'Pass' ? '' : status === 'Unscored' ? ' pending' : ' fail'}`, status));
  summary.append(element('span', 'run-mini', `${formatMs(run.metrics?.durationMs)} · ${run.metrics?.outputCharacters ?? '—'} chars`));
  details.append(summary);
  const body = element('div', 'run-detail');
  if (run.error) body.append(element('p', 'inline-message error', run.error));
  if (run.gates) {
    const section = element('section', 'detail-section');
    section.append(element('h3', '', 'Deterministic gates'));
    const grid = element('div', 'gate-grid');
    run.gates.forEach((gate) => grid.append(scoreCard(gate.label, gate.passed ? 'PASS' : 'FAIL', gate.detail, !gate.passed)));
    section.append(grid); body.append(section);
  }
  if (run.judgment?.rubric) {
    const section = element('section', 'detail-section');
    section.append(element('h3', '', `Rubric · ${run.judgment.summary?.rubricPercent ?? '—'}%`));
    const grid = element('div', 'rubric-grid');
    state.config.rubric.forEach(({ key, label }) => {
      const grade = run.judgment.rubric[key];
      grid.append(scoreCard(label, `${Math.round((grade?.score ?? 0) * 100)}%`, grade?.reason || '', grade?.score < 1));
    });
    section.append(grid);
    if (run.judgment.rubric.correctnessConcern) section.append(element('p', 'inline-message error', `Correctness concern: ${run.judgment.rubric.correctnessConcern}`));
    body.append(section);
  }
  if (run.output) {
    const section = element('section', 'detail-section');
    section.append(element('h3', '', 'Generated JSON'));
    const pre = element('pre'); pre.textContent = JSON.stringify(run.output, null, 2); section.append(pre); body.append(section);
  }
  details.append(body);
  return details;
}

function renderEvaluation() {
  const record = state.evaluation;
  if (!record) return $('eval-results').classList.add('hidden');
  $('eval-results').classList.remove('hidden');
  const runs = record.runs || [];
  const scored = runs.filter((run) => run.judgment?.summary?.rubricPercent != null);
  const passed = runs.filter((run) => run.judgment?.summary?.passed).length;
  $('eval-summary').replaceChildren();
  addSummary('Runs completed', `${runs.length} / 9`);
  addSummary('Passed', record.withJudge ? String(passed) : '—');
  addSummary('Average rubric', scored.length ? `${Math.round(scored.reduce((sum, run) => sum + run.judgment.summary.rubricPercent, 0) / scored.length)}%` : '—');
  addSummary('Prompt · model', `${record.promptVersion} · ${record.model}`);
  $('run-list').replaceChildren(...runs.map(renderRun));
}

async function runEvaluation() {
  if (state.isRunning) return;
  if (!state.config.keyConfigured) return setMessage('eval-progress', 'Add OPENAI_API_KEY to .env and restart the server before running the suite.', true);
  state.isRunning = true;
  $('run-eval-btn').disabled = true;
  const settings = { ...state.settings };
  state.evaluation = {
    version: 1,
    startedAt: new Date().toISOString(),
    completedAt: null,
    promptVersion: settings.activePrompt,
    systemPrompt: settings.activePrompt === 'B' ? settings.promptB : settings.promptA,
    formatPrompt: state.config.formatPrompt,
    model: settings.model,
    judgeModel: settings.judgeModel,
    withJudge: $('judge-enabled').checked,
    tasks: state.config.tasks,
    rubric: state.config.rubric,
    runs: []
  };
  renderEvaluation(); persistSession();
  let number = 0;
  for (const task of state.config.tasks) {
    for (let trial = 1; trial <= 3; trial++) {
      number++;
      setMessage('eval-progress', `Generating ${number} of 9: ${task.label}, trial ${trial}…`);
      const run = { taskId: task.id, trial, output: null, gates: null, metrics: null, judgment: null, error: null };
      try {
        const generated = await api('api/generate', { taskId: task.id, model: settings.model, systemPrompt: state.evaluation.systemPrompt });
        run.output = generated.output; run.gates = generated.gates; run.metrics = generated.metrics;
        if (state.evaluation.withJudge) {
          setMessage('eval-progress', `Scoring ${number} of 9: ${task.label}, trial ${trial}…`);
          try { run.judgment = await api('api/judge', { taskId: task.id, model: settings.judgeModel, output: run.output }); }
          catch (error) { run.error = `Judge failed: ${error.message}`; }
        }
      } catch (error) { run.error = `Generation failed: ${error.message}`; }
      state.evaluation.runs.push(run);
      renderEvaluation(); persistSession();
    }
  }
  state.evaluation.completedAt = new Date().toISOString();
  persistSession();
  renderEvaluation();
  state.isRunning = false;
  $('run-eval-btn').disabled = false;
  setMessage('eval-progress', 'All nine trials finished. Inspect the outputs and export the JSON bundle.');
}

async function copyText(value, successId, successText) {
  try { await navigator.clipboard.writeText(value); if (successId) setMessage(successId, successText); }
  catch { if (successId) setMessage(successId, 'Could not copy automatically. Use the Download JSON button.', true); }
}

function bindEvents() {
  document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  document.querySelectorAll('[data-suggestion]').forEach((button) => button.addEventListener('click', () => { $('request-input').value = button.dataset.suggestion; $('request-input').focus(); }));
  $('generate-btn').addEventListener('click', generatePractice);
  $('chat-send-btn').addEventListener('click', sendChat);
  $('chat-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); sendChat(); } });
  $('demo-btn').addEventListener('click', () => renderExercise(demoExercise, { demo: true }));
  $('solution-toggle').addEventListener('click', () => toggleSolution($('solution-card').classList.contains('hidden')));
  $('hide-solution-btn').addEventListener('click', () => toggleSolution(false));
  $('copy-json-btn').addEventListener('click', () => state.exercise && copyText(JSON.stringify(state.exercise, null, 2), 'practice-message', 'Problem JSON copied.'));
  $('copy-code-btn').addEventListener('click', () => copyText($('code-editor').value, 'practice-message', 'Your code copied.'));
  $('copy-solution-btn').addEventListener('click', () => copyText(state.exercise?.solution?.code || '', 'practice-message', 'Reference code copied.'));
  $('reset-code-btn').addEventListener('click', () => { $('code-editor').value = state.exercise?.problem?.starterCode || ''; updateLineNumbers(); persistSession(); });
  $('code-editor').addEventListener('input', () => { updateLineNumbers(); persistSession(); });
  $('code-editor').addEventListener('scroll', updateLineNumbers);
  $('code-editor').addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const editor = event.target; const start = editor.selectionStart; const end = editor.selectionEnd;
    editor.setRangeText('    ', start, end, 'end'); updateLineNumbers(); persistSession();
  });
  $('request-input').addEventListener('input', persistSession);
  $('run-eval-btn').addEventListener('click', runEvaluation);
  $('copy-eval-btn').addEventListener('click', () => state.evaluation && copyText(JSON.stringify(state.evaluation, null, 2), 'eval-progress', 'Evaluation bundle copied. Paste it into this chat for review.'));
  $('download-eval-btn').addEventListener('click', () => {
    if (!state.evaluation) return;
    const blob = new Blob([JSON.stringify(state.evaluation, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = element('a'); link.href = url; link.download = `pattern-lab-eval-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('prompt-a-switch').addEventListener('click', () => { state.settings.activePrompt = 'A'; persistSettings(); });
  $('prompt-b-switch').addEventListener('click', () => { state.settings.activePrompt = 'B'; persistSettings(); });
  for (const [id, key] of [['model-input', 'model'], ['judge-model-input', 'judgeModel'], ['prompt-a-input', 'promptA'], ['prompt-b-input', 'promptB']]) {
    $(id).addEventListener('input', () => { state.settings[key] = $(id).value; persistSettings(); });
  }
  $('access-token-input').addEventListener('input', () => sessionStorage.setItem(STORAGE_ACCESS, $('access-token-input').value));
  $('reset-settings-btn').addEventListener('click', () => {
    state.settings.promptA = state.config.prompts.A; state.settings.promptB = state.config.prompts.B;
    $('prompt-a-input').value = state.settings.promptA; $('prompt-b-input').value = state.settings.promptB;
    persistSettings(); setMessage('settings-message', 'Default prompts restored.');
  });
}

async function init() {
  try {
    const response = await fetch('api/config');
    if (!response.ok) throw new Error('Could not load app configuration.');
    state.config = await response.json();
  } catch (error) { $('connection-text').textContent = error.message; return; }
  $('connection-pill').classList.toggle('ready', state.config.keyConfigured);
  $('connection-text').textContent = state.config.keyConfigured ? 'API ready' : 'API key needed';
  const saved = safeJson(localStorage.getItem(STORAGE_SETTINGS), {});
  state.settings = {
    activePrompt: saved.activePrompt === 'B' ? 'B' : 'A',
    promptA: typeof saved.promptA === 'string' ? saved.promptA : state.config.prompts.A,
    promptB: typeof saved.promptB === 'string' ? saved.promptB : state.config.prompts.B,
    model: typeof saved.model === 'string' ? saved.model : state.config.defaultModel,
    judgeModel: typeof saved.judgeModel === 'string' ? saved.judgeModel : state.config.defaultModel
  };
  $('model-input').value = state.settings.model;
  $('judge-model-input').value = state.settings.judgeModel;
  $('prompt-a-input').value = state.settings.promptA;
  $('prompt-b-input').value = state.settings.promptB;
  $('format-prompt-text').textContent = state.config.formatPrompt;
  $('access-token-input').value = sessionStorage.getItem(STORAGE_ACCESS) || '';
  updateConfigLabels(); renderTasks(); bindEvents(); showView(location.hash.slice(1));
  const session = safeJson(sessionStorage.getItem(STORAGE_SESSION), null);
  if (session) {
    $('request-input').value = session.request || '';
    if (session.exercise) { renderExercise(session.exercise, session.exerciseMeta || {}); $('code-editor').value = session.draft || session.exercise.problem?.starterCode || ''; updateLineNumbers(); state.chatHistory = session.chatHistory || []; renderChat(); persistSession(); }
    state.evaluation = session.evaluation || null; renderEvaluation();
  }
  if (!state.config.keyConfigured) setMessage('practice-message', 'Add an OpenAI API key in .env to generate new problems. The sample preview is available now.');
}

init();
