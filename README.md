# Pattern Lab — Coding Tutor

A small coding tutor built as a practical exercise in evaluating AI outputs. It generates LeetCode-style Python problems with examples, constraints, and starter code. The explanation and reference solution stay hidden in a separate pane until revealed. Follow-up chat, editable prompts, and model selection support experimenting with different tutor configurations.

[Open the interactive preview](https://moritzfrieling.github.io/Coding-Tutor/)

GitHub Pages hosts the sample workspace and prompt controls. AI generation, tutoring chat, and evaluation require the Node server below, where the Gemini API key is kept.

## Evaluation approach

The evaluation design draws on Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), using tasks, repeated trials, graders, and a simple harness. The tutor currently generates a structured response in a single call; it does not use tools in an autonomous agent loop. Evaluation focuses on model outputs rather than UI behaviour.

Two system prompts can be compared: **Prompt A**, a short baseline, and **Prompt B**, detailed tutor instructions. Both receive the same JSON format instruction. The suite includes a medium sliding-window problem, an unspecified problem request, and a hard hash-map problem. Each task runs three times, producing **nine generations per configuration**.

Required gates and quality scores are assessed separately:

- **Deterministic gates:** required fields, requested difficulty and topic labels, and a separate solution field.
- **Six equally weighted rubric scores:** problem completeness, internal consistency, useful examples, principle-first explanation, solution alignment, and transferable teaching. A separate judge call awards each dimension 0, 0.5, or 1 and explains its score.
- **Success:** every gate passes and the average rubric score is **above 75%**. Results are reported for each trial.

Exported JSON bundles include generation duration, output length, prompts, model IDs, generated responses, gates, and judge feedback for manual review. Enabling the judge adds nine requests, for 18 model calls per suite.

The gates verify structure and declared labels, not actual difficulty, pattern use, solvability, or Python correctness. The judge's correctness assessment is advisory. Code execution and independently verified correctness tests are not implemented; this small suite is a learning exercise rather than evidence of production reliability.

## Run locally

Requires Node.js 20 or newer. No dependencies need installing.

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY` to a Google AI Studio key.
3. Run `npm start` and open [localhost:4173](http://127.0.0.1:4173/).

Prompts and model IDs are editable in **Admin**. Settings persist in localStorage; the latest exercise, draft, conversation, and evaluation remain in sessionStorage for the tab session. Export JSON to keep results beyond that session. There is no database, and `.env` is excluded from Git.

## Publish the preview

Run `npm run build:pages` to copy the interface and public configuration into `docs/`, then commit and push to `main`. GitHub Pages publishes that folder. The preview contains no API key and no backend.

For a full deployment, run `server.mjs` behind an HTTPS reverse proxy. Set `BASE_PATH=/pattern-lab/` when hosting under that path and preserve the prefix when forwarding requests. A non-local server address also requires `APP_ACCESS_TOKEN`.
