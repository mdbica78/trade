## QA run 1 — 2026-10-05 23:50
Verdict: PASS
Machine checks: 8/8 AUTO and AUTO-PARTIAL passed   Left for the user: 1

Each `pnpm` command below ran in `bash -lc` with the exact prefix
`env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY`.
The commands and exit codes below are from this QA run, not the independent
verdicts. No real variable values were printed or used. The shell commands
with `| tail` used `set -o pipefail`, so the reported exit is the gate's exit.

| # | Check (source) | Type | Result | Evidence (exact command after the prefix above → exit → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 599ms using pnpm v12.5.1`. |
| 2 | Prompt isolation, all-active expansion, match execution, per-ETF outcomes, inactive rejection, action ordering (AC2–AC7; qa.md #2) | AUTO | PASS | `pnpm exec vitest run lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/ai/capabilities/action-list.test.ts lib/ai/capabilities/configuration/prompt.test.ts lib/ai/capabilities/widgets/intent.test.ts lib/ai/capabilities/widgets/execute.test.ts lib/ai/capabilities/widgets/execute.pglite.test.ts lib/ai/capabilities/widgets/context.test.ts lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts app/chat/reply-messages.test.ts app/chat/actions.test.ts 2>&1 \| tail -n 12` → 0 → `Test Files 12 passed (12); Tests 311 passed (311)`; observed PGlite T-4/T-5/T-6/T-7/T-8 PASS, including no-ETF default, inactive exclusion and validation-before-write. |
| 3 | Typecheck (AC1; qa.md #1) | AUTO | PASS | `pnpm typecheck` → 0 → `$ tsc --noEmit`, no errors. |
| 4 | Lint (AC1; qa.md #1) | AUTO | PASS | `pnpm lint 2>&1 \| tail -n 10` → 0 → `11 problems (0 errors, 11 warnings)`. |
| 5 | Full regression (AC1; qa.md #1) | AUTO | PASS | `pnpm test 2>&1 \| tail -n 12` → 0 → `Test Files 224 passed (224); Tests 2341 passed (2341)`. No snapshot update mode. |
| 6 | Offline build (AC1; qa.md #1) | AUTO | PASS | `pnpm build 2>&1 \| tail -n 28` → 0 → `Finished TypeScript in 9.0s`, `[load-error] home name=MissingDatabaseUrlError`, 12 dynamic routes including `/chat`; no production database was configured. |
| 7 | Predeploy gate (AC1; plan §1) | AUTO | PASS | `bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 18` → 0 → `Test Files 224 passed (224); Tests 2341 passed (2341); PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` This is evidence of local checks only; no commit or push was performed. |
| 8 | RO/EN no-DB `/chat` (qa.md #4) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY bash scripts/claude/qa-serve.sh start` → 0 → `QA server ready on http://127.0.0.1:3100 (database: none)`. `bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro` → 0 → `STATUS 200`, `Chat de configurare`, `Datele nu au putut fi încărcate`; `bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en` → 0 → `STATUS 200`, `Configuration chat`, `Could not load the data`. Both show existing eight instruction items, five-action cap and no-keys-in-chat guidance. Browser `/chat` in EN then RO also showed the matching translations and safe no-DB errors. `bash scripts/claude/qa-serve.sh stop` → 0 → `QA server stopped.` |

One initial pair of parallel locale probes returned the opposite language
from their requested cookies; isolated probes and a second parallel pair
returned the correct locales. A fresh server start with parallel probes
again returned the correct locales. The initial discrepancy was not
reproduced, so it is recorded as an observation, not claimed as a verified
product failure; if it recurs, investigate locale handling independently.
Both QA server starts were followed by `qa-serve.sh stop` (exit 0).

### For the user

- [LIVE-DB / LIVE-ACCOUNT] With a configured provider and Neon, on `/chat`
  request "add max value for units in circulation for last 30 days" without
  naming an ETF. Confirm a widget appears for each active ETF and not for a
  deactivated one. Then request "clear max value for units in circulation for
  last month for all etf"; confirm only matching widgets disappear and an ETF
  without one gets a "No custom value matched" reply. Model interpretation
  quality with a real provider is not proven by the recorded-output tests.

No live Neon, BVB, Vercel, AI provider, stored key, production migration,
deployment or git operation was used. Files changed by QA: this report,
only the US-053 Story board row in `dev_minions/status.md`, and a QA/Deploy
log append in `dev_minions/HANDOVER.md`. Denied or attempted commands: none.
