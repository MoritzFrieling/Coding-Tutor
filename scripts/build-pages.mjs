import fs from 'node:fs/promises';
import { PROMPT_A, PROMPT_B, FORMAT_PROMPT, EVAL_TASKS, RUBRIC } from '../lib/config.mjs';

const root = new URL('../', import.meta.url);
const destination = new URL('docs/', root);
await fs.mkdir(destination, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'favicon.svg']) {
  await fs.copyFile(new URL('public/' + file, root), new URL(file, destination));
}
const config = {
  prompts: { A: PROMPT_A, B: PROMPT_B }, formatPrompt: FORMAT_PROMPT,
  tasks: EVAL_TASKS, rubric: RUBRIC, defaultModel: 'gemini-3.5-flash-lite',
  keyConfigured: false, accessTokenRequired: false, staticPreview: true
};
await fs.writeFile(new URL('runtime-config.json', destination), JSON.stringify(config, null, 2));
await fs.writeFile(new URL('.nojekyll', destination), '');
console.log('Built GitHub Pages preview in docs/ without credentials.');
