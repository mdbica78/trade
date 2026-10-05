## QA run 1 — 2026-10-05 10:47
Verdict: PASS
Machine checks: 7/7 AUTO and AUTO-PARTIAL   Left for the user: 1

The shared install/typecheck/lint/full regression/build gates below were run by this QA session
at approximately 10:22–10:38, after US-050's implementation was complete. They were first
recorded for the preceding US-040 recheck and were not rerun after US-050 became Awaiting QA.
The US-050-specific golden and PGlite suite and the served-app checks were run after delivery.
No machine result from the independent developer verdicts is treated as QA evidence.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm install --frozen-lockfile'` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 589ms using pnpm v12.5.1` (shared check earlier this cycle). |
| 2 | Typecheck and lint (qa.md #1, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm typecheck'` → 0 → `$ tsc --noEmit`; same command prefix with `pnpm lint` → 0 → `11 problems (0 errors, 11 warnings)` (shared checks earlier this cycle). |
| 3 | Full suite (qa.md #1, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm test'` → 0 → `Test Files 220 passed (220); Tests 2232 passed (2232)` (shared check earlier this cycle). |
| 4 | Offline build (qa.md #1, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build'` → 0 → `migrate-on-deploy: skipped (not a production build)`, `Compiled successfully in 9.4s`, 12 dynamic routes (shared check earlier this cycle). |
| 5 | Golden markup, delta math, two optional-table fallbacks and shared label rules (AC2–AC5) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run components/home-markup.golden.test.tsx lib/monitoring/home-fallback.pglite.test.ts lib/monitoring/home-display.pglite.test.ts lib/monitoring/home.pglite.test.ts lib/monitoring/delta.test.ts lib/monitoring/exact-decimal.test.ts lib/monitoring/widget-engine.test.ts lib/format/delta.test.ts lib/format/label.test.ts lib/monitoring/panel-order.test.ts app/load-error.boundary.test.ts'` → 0 → `Test Files 11 passed (11); Tests 109 passed (109)`. Snapshot checks passed without `-u`; HD-H5/H6 establish B3/B5, HD-H7/H8 prove missing-table paths, HF-1..HF-7 preserve fallback behavior. |
| 6 | Home panel browser click, locale switch, routes (qa.md #2–4) | AUTO-PARTIAL | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY bash scripts/claude/qa-serve.sh start'` → 0 → `QA server ready ... (database: none)`. Browser `http://127.0.0.1:3100/`: clicked `Personalizează afișarea`; expanded panel had groups `ETF-uri`, `Coloane de valori`, `Variații` with three checked change switches; switched locale via EN and got `ETFs`, `Value columns`, `Changes` and translated safe load error. For each locale `ro`, `en` and each route `/`, `/etf/BTBETRETF`, `/admin`, `/admin/etfs`, `/admin/ai`, `/admin/cron`, `/admin/operations`, `/chat`, `bash -lc "bash scripts/claude/qa-serve.sh get $route NEXT_LOCALE=$locale"` → 0, `STATUS 200` (16 responses) and localized headings/safe no-DB states. With no DB, there are no populated table cells, history charts, or tracked-field catalogue options to visually inspect; golden and PGlite tests cover those paths offline. |
| 7 | Stop local server (qa.md #2–4) | AUTO | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` |

### For the user
- [JUDGMENT] When viewing populated data after the ordinary push, does the home table, history chart, and Customize panel still look/behave as before? Offline no-database pages cannot show populated fields, deltas or charts; the unchanged golden markup snapshot and PGlite tests pass. AC1–AC6 remain drafted for PO confirmation.

No live Neon/Vercel/provider or real key was accessed; no migration/deployment was run.
Files changed by QA: `dev_minions/verification/US-050-qa-run.md`, the US-050 row in
`dev_minions/status.md`, and an append to the HANDOVER QA/Deploy log.
Denied or attempted commands: none.
