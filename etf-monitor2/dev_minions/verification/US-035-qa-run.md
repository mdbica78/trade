## QA run 1 — 2026-09-29 08:03

Verdict: BLOCKED

Machine checks: 2/3 AUTO passed; full gate blocked by an in-progress shared TypeScript error. Left for the user: 0.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (QA #1) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 514ms using pnpm v12.5.1`. |
| 2 | Tokens, contrast, theme resolver/toggle, header, palette, semantic hooks, scroll wrapper, literal scan (AC1–AC8, AC10) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run ...` (14 US-035-focused files) → 0 → `Test Files 14 passed (14)`, `Tests 71 passed (71)`. |
| 3 | Full typecheck/lint/build/test gate (AC11, QA #2–5) | AUTO | BLOCKED | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 1 → `lib/ingestion/default-deps.cron.test.ts(30,32): error TS2554: Expected 2 arguments, but got 1.` The file belongs to active in-progress US-037, not US-035; handover identifies US-037 as implementation phase. |

### Blocker

- The shared project typecheck fails before US-035’s build/test gates can run because of `lib/ingestion/default-deps.cron.test.ts:30`. Re-run this QA after US-037 resolves the active-story error. No US-035 product failure was observed, and no code was changed by QA.

## QA run 2 — 2026-09-29 09:38

Verdict: PASS

Machine checks: all required AUTO checks passed. One visual-comparison item remains a user JUDGMENT because this QA environment has no browser surface available for screenshot capture; it is not a product failure.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Full typecheck, lint, production build and regression suite (AC11; QA #2–5) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → `PREDEPLOY: PASS — typecheck, lint, build and tests are green.`; lint: 0 errors, 9 warnings; tests: `Test Files 186 passed (186)`, `Tests 1882 passed (1882)`. |
| 2 | Visual layer’s focused test suite: tokens, contrast, resolver/toggle, header/nav, palette, semantic hooks, home wrapper and literal scan (AC1–AC8, AC10) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run …` (14 US-035-focused files) → 0 → `Test Files 14 passed (14)`, `Tests 71 passed (71)`. The next-intl missing-time-zone messages are test-environment warnings only; all tests passed. |
| 3 | Local served home page in Romanian and English (AC3–AC5, AC7–AC8) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh get /` and `… get / "NEXT_LOCALE=en"` → 0 → both `STATUS 200`; rendered RO controls include `Acasă … Luminos / Întunecat`, and EN includes `Home … Light / Dark`. The no-database QA-server error state is expected. |
| 4 | Local ETF detail route responds under the QA server | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh get /etf/BTBETRETF "NEXT_LOCALE=en"` → 0 → `STATUS 200`. No database was configured, so its expected rendered content is the safe load-error state. |
| 5 | Light/dark screenshots at desktop and 390px; toggle persistence, blocked-storage resilience, keyboard focus and chart recolour (QA #6–10) | JUDGMENT | USER | The QA server started and was stopped cleanly, but the available computer-use surface reported no usable browser (`Browser is not available: iab`), so screenshot and interaction capture could not be performed honestly. Please compare the binding `backlog/home-design/` reference images at desktop/mobile after deployment, toggle Light/Dark and reload, tab to the theme button, and open an ETF with history to observe chart recolouring. |

The run-1 shared US-037 TypeScript blocker is resolved: the full pre-deploy gate is now green. QA changed no application code.
