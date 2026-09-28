const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generate({ key, model, instructions, input, schema }) {
  const contents = (typeof input === 'string' ? [{ role: 'user', content: input }] : input)
    .map(({ role, content }) => ({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] }));
  const started = performance.now();
  const response = await fetch(`${API_ROOT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents,
      ...(schema ? { generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } } } } : {})
    }),
    signal: AbortSignal.timeout(180_000)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Google returned non-JSON HTTP ${response.status}.`); }
  if (!response.ok) throw new Error(String(data?.error?.message || `Google returned HTTP ${response.status}.`).slice(0, 400));
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((part) => typeof part.text === 'string').map((part) => part.text).join('');
  if (!text.trim()) throw new Error(`Google returned no text${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}.`);
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error(`Google stopped before completing the response (${candidate.finishReason}).`);
  return {
    text,
    metrics: {
      durationMs: Math.round(performance.now() - started),
      outputCharacters: text.length,
      inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null
    }
  };
}

export async function requestStructured({ key, model, instructions, input, schema }) {
  const result = await generate({ key, model, instructions, input, schema });
  let data;
  try { data = JSON.parse(result.text); }
  catch { throw new Error('Google returned invalid JSON for a structured output.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Google returned JSON that is not an object.');
  return { data, metrics: result.metrics };
}

export async function requestText({ key, model, instructions, input }) {
  const result = await generate({ key, model, instructions, input });
  return { text: result.text, durationMs: result.metrics.durationMs };
}
