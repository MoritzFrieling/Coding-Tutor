# Pattern Lab

A small coding tutor and evaluation studio. The browser asks for a problem, the Node server calls the OpenAI Responses API, and a structured JSON response becomes three separate surfaces: the problem, a Python starter editor, and a solution pane that stays closed until requested. The learner can also ask follow-up questions about the current problem.

## Run locally

Requires Node.js 20 or newer. No package installation is needed.

1. Copy `.env.example` to `.env`.
2. Put an OpenAI API key in `OPENAI_API_KEY` in `.env`. Keep this file private; Git ignores it.
3. Run `npm start` from this directory.
4. Open `http://127.0.0.1:4173/`.

The UI and sample problem are available before an API key is configured. Generation, chat, and AI judging require the key. A ChatGPT account and an API key are separate ways of accessing OpenAI models; the web app calls the API from its Node server.

## What the app stores

- The two editable system prompts and model IDs are saved in browser `localStorage`.
- The latest problem, code draft, tutor conversation, and latest evaluation bundle are kept in `sessionStorage`, which lasts for the tab session.
- An optional app access token is held in `sessionStorage`.
- There is no database. The server does not save generated outputs or conversations.
- `Copy bundle` or `Download JSON` exports the complete latest evaluation for review elsewhere.

## Prompt versions

The default active system prompt is **Prompt A**, the short baseline requested for this exercise. **Prompt B** contains the detailed tutor instructions. Both are editable in Admin and can be switched without changing code. The server appends a separate, fixed output-format instruction to either version and requests a strict JSON schema through the Responses API. The schema lives in `lib/config.mjs`.

The default tutor and judge model ID is `gpt-6-sol`. Admin accepts any model ID that your API account can access. The API key always stays on the server.

## Evaluation design

The fixed suite has three user requests: medium sliding window, an open request, and hard hash maps. Each task runs three times, giving nine generations for the selected prompt and model. If AI judging is enabled, each generation receives one additional judge call.

Four deterministic checks are reported separately:

1. Required schema fields and sections are present.
2. The declared difficulty matches the request, when specified.
3. The declared topic matches the request, when specified.
4. The solution is returned in a separate field rather than copied into the visible problem.

The six equal-weight rubric dimensions are completeness, internal consistency, useful examples, principle-first explanation, solution alignment, and transferable teaching. Each receives 0, 0.5, or 1 from an independent model judge. A run passes when every deterministic check passes and the mean rubric score is **above** 75%. The export includes all individual scores, reasons, generated JSON, timing, output length, model IDs, and the system prompt text used for the run.

**Important limit:** the topic and difficulty checks verify the model's declared labels. Their substance, and the correctness of a freshly invented problem or solution, require semantic review. The AI judge flags likely mistakes but does not execute Python or prove correctness. Inspect suspicious outputs yourself. Add independently verified reference problems and tests later if you want a true executable correctness gate.

The app uses its own simple harness instead of the legacy OpenAI Evals API. This keeps the exercise portable and the exported JSON easy to inspect.

## Add to a private website later

The Node app can run behind a reverse proxy on the same server as your private site. Set `BASE_PATH=/pattern-lab/` in `.env`, route that path to the Node process **without removing the path prefix**, and visit `https://your-host/pattern-lab/`. You can also serve it at the root of a separate subdomain with `BASE_PATH=/`.

Keep `HOST=127.0.0.1` when a reverse proxy on the same machine connects to it. If the Node process must listen on a public interface, set a strong `APP_ACCESS_TOKEN`; the app refuses to start on a non-local address without one. The Admin screen has a field for this token. A public deployment should also sit behind the private site's normal authentication and HTTPS. Do not expose `.env` or the API key as a static file.

This project does not modify or deploy to the existing website.

## Files

- `server.mjs`: HTTP server and API routes.
- `lib/config.mjs`: prompts, structured output schema, tasks, and rubric.
- `lib/evaluation.mjs`: deterministic checks and score aggregation.
- `lib/openai.mjs`: OpenAI Responses API calls.
- `public/`: browser interface.

The Responses API request uses the [official Structured Outputs format](https://developers.openai.com/api/docs/guides/structured-outputs). Model IDs can be changed in Admin; see the [official model selection guide](https://developers.openai.com/api/docs/guides/model-selection) for current options.
