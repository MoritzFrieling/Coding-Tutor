# Pattern Lab — Coding Tutor

I built this small coding tutor to practise evaluating AI outputs. It generates LeetCode-style Python problems with examples, constraints, and starter code, then keeps the explanation and reference solution in a separate pane until I reveal them. I can ask follow-up questions and switch prompts or Gemini models.

[Open my interactive preview](https://MoritzFrieling.github.io/Coding-Tutor/)

GitHub Pages hosts my sample workspace and editable prompt controls. AI generation, tutoring chat, and evaluation require the Node server below; I keep my Gemini API key on that server.

## My evaluation approach

I adapted the task, trial, grader, and harness structure from Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). My tutor currently produces a structured response in one generation rather than using tools in an autonomous agent loop. I evaluate the generated output, with UI behaviour outside the scoring scope.

I compare **Prompt A**, a short baseline, with **Prompt B**, detailed tutor instructions. Both receive the same JSON format instruction. My suite contains three tasks: a medium sliding-window problem, an unspecified problem request, and a hard hash-map problem. I repeat each task three times: **nine generations per configuration**.

I separate required gates from quality scores:

- **Deterministic gates:** required fields, requested difficulty and topic labels, and a separate solution field.
- **Six equally weighted rubric scores:** problem completeness, internal consistency, useful examples, principle-first explanation, solution alignment, and transferable teaching. A separate judge call awards each dimension 0, 0.5, or 1 and explains its score.
- **Success:** every gate passes and the average rubric score is **above 75%**. I assess each trial separately and inspect the suite results.

I record generation duration and output length, along with prompts, model IDs, generated JSON, gates, and judge feedback. I can export the bundle for manual review. Enabling the judge makes nine additional requests, for 18 model calls per suite.

The gates check structure and declared labels; they do not prove the actual difficulty, pattern, solvability, or Python correctness. My judge's correctness assessment is advisory. I have not added code execution or independently verified correctness tests yet, and this small suite is a learning exercise rather than evidence of production reliability.

## Run locally

I use Node.js 20 or newer; no dependencies need installing.

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY` to a Google AI Studio key.
3. Run `npm start` and open [localhost:4173](http://127.0.0.1:4173/).

I edit prompts and model IDs in **Admin**. Settings persist in localStorage; my latest exercise, draft, conversation, and evaluation stay in sessionStorage for the tab session. I export JSON to keep results beyond that session. There is no database, and `.env` stays out of Git.

## Publish the preview

I run `npm run build:pages` to copy the interface and public configuration into `docs/`, then commit and push to `main`. GitHub Pages publishes the `docs/` folder on that branch. The preview contains no API key and no backend.

For a full deployment, I run `server.mjs` behind an HTTPS reverse proxy. I can set `BASE_PATH=/pattern-lab/` and preserve that prefix when forwarding requests. A non-local server address also requires `APP_ACCESS_TOKEN`.
