const OPENAI_URL = 'https://api.openai.com/v1/responses';

function extractText(response) {
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('');
}

export async function requestStructured({ key, model, instructions, input, schema, schemaName }) {
  const started = performance.now();
  const reply = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      store: false,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } }
    }),
    signal: AbortSignal.timeout(180_000)
  });
  const raw = await reply.text();
  let response;
  try { response = JSON.parse(raw); } catch { throw new Error('OpenAI returned a response that could not be parsed.'); }
  if (!reply.ok) {
    const message = response?.error?.message || `OpenAI returned HTTP ${reply.status}.`;
    throw new Error(message.slice(0, 400));
  }
  if (response.status && response.status !== 'completed') {
    throw new Error(`OpenAI response status: ${response.status}. ${response.incomplete_details?.reason || ''}`.trim());
  }
  const text = extractText(response);
  if (!text) throw new Error('OpenAI returned no text output.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('The structured response was not valid JSON.'); }
  return {
    data,
    metrics: {
      durationMs: Math.round(performance.now() - started),
      outputCharacters: text.length,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null
    }
  };
}

export async function requestText({ key, model, instructions, input }) {
  const started = performance.now();
  const reply = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions, input, store: false }),
    signal: AbortSignal.timeout(180_000)
  });
  const raw = await reply.text();
  let response;
  try { response = JSON.parse(raw); } catch { throw new Error('OpenAI returned a response that could not be parsed.'); }
  if (!reply.ok) throw new Error((response?.error?.message || `OpenAI returned HTTP ${reply.status}.`).slice(0, 400));
  if (response.status && response.status !== 'completed') throw new Error(`OpenAI response status: ${response.status}.`);
  const text = extractText(response);
  if (!text) throw new Error('OpenAI returned no text output.');
  return { text, durationMs: Math.round(performance.now() - started) };
}
