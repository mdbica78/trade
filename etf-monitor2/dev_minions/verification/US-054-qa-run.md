## QA run 1 — 2026-10-06 11:03
Verdict: BLOCKED
Machine checks: 7/8 AUTO and AUTO-PARTIAL passed   Left for the user: 1

Each `pnpm` command below ran in `bash -lc` with the exact prefix
`env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY`.
No variable values were printed. This run is blocked by a test-load
failure in the combined predeploy gate; the same PGlite hook files pass in
isolation, so the product defect is not established.

| # | Check (source) | Type | Result | Evidence (exact command after the prefix above → exit → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 2s using pnpm v12.5.1`. |
| 2 | Focused US-054 regression (qa.md #2) | AUTO | PASS | `pnpm exec vitest run lib/ai/capabilities/normalise.test.ts lib/ai/chat.regression.test.ts lib/ai/capabilities/configuration/prompt.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts app/chat/reply-messages.golden.test.ts components/chat/chat-markup.golden.test.tsx 2>&1 \| tail -n 18` → 0 → `Test Files 9 passed (9); Tests 285 passed (285)`. |
| 3 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` → 0 → `$ tsc --noEmit`, no errors. |
| 4 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint 2>&1 \| tail -n 10` → 0 → `13 problems (0 errors, 13 warnings)`. |
| 5 | Full regression (qa.md #1) | AUTO | PASS | `pnpm test 2>&1 \| tail -n 18` → 0 → `Test Files 228 passed (228); Tests 2475 passed (2475)`. |
| 6 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build 2>&1 \| tail -n 30` → 0 → `Compiled successfully`, `[load-error] home name=MissingDatabaseUrlError`, 12 dynamic routes including `/chat`. |
| 7 | Predeploy gate (qa.md #1) | AUTO | BLOCKED | `bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 17` → 1 → `Test Files 15 failed | 215 passed (230)`; `Error: Hook timed out in 30000ms` in `lib/ai/capabilities/configuration/execute.pglite.test.ts` and `lib/ai/capabilities/widgets/execute.pglite.test.ts`; `PREDEPLOY: FAIL at 'pnpm test' — do not push.` |
| 8 | RO/EN `/chat` without a database (qa.md #4) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh start` → 0 → `QA server ready on http://127.0.0.1:3100 (database: none)`. `bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro` → 0 → `STATUS 200`, `Chat de configurare`, `Datele nu au putut fi încărcate`. `bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en` → 0 → `STATUS 200`, `Configuration chat`, `Could not load the data`. `bash scripts/claude/qa-serve.sh stop` → 0 → `QA server stopped.` |

### Blocked detail

The combined predeploy gate re-ran the full suite and hit hook timeouts in
two PGlite files under concurrent load:
[execute.pglite.test.ts](/mnt/c/_mystaff/myG/trade/etf-monitor2/lib/ai/capabilities/configuration/execute.pglite.test.ts)
and
[execute.pglite.test.ts](/mnt/c/_mystaff/myG/trade/etf-monitor2/lib/ai/capabilities/widgets/execute.pglite.test.ts).
The same two files passed in isolation in a direct rerun, so this QA result
records a test-load/environment blockage rather than a confirmed product
regression.

### For the user

- [LIVE-DB / LIVE-ACCOUNT] With a configured provider and Neon, on `/chat`
  request "add max value for units in circulation for last 30 days" without
  naming an ETF. Confirm a widget appears for each active ETF and not for a
  deactivated one. Then request "clear max value for units in circulation for
  last month for all etf"; confirm only matching widgets disappear and an ETF
  without one gets a "No custom value matched" reply.

No live Neon, BVB, Vercel, AI provider, stored key, production migration,
deployment or git operation was used. Files changed by QA: this report,
only the US-054 Story board row in `dev_minions/status.md`, and a QA/Deploy
log append in `dev_minions/HANDOVER.md`. Denied or attempted commands: none.

## QA run 2 — 2026-10-09
Verdict: PASS
Machine checks: focused normalization/prompt regressions and shared current-tree predeploy PASS.
Live-provider checks remain for the user.

The user-authorized QA override was used although the dev-loop status printed
`STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`.
The development loop was not restarted. Database, cron, master-key and provider-key variables
were unset for checks; no values were printed.

| Check | Result | Exact command → exit code → output |
|---|---|---|
| Development-loop gate | Override used | `bash -lc 'bash scripts/claude/dev-loop-status.sh; printf "GATE_EXIT=%s\n" "$?"'` → 0 (wrapper; inner status printed STOPPED) → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. |
| Focused US-054 prompt, normalization and chat regressions | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/ai/capabilities/normalise.test.ts lib/ai/chat.regression.test.ts lib/ai/capabilities/configuration/prompt.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts app/chat/reply-messages.golden.test.ts components/chat/chat-markup.golden.test.tsx 2>&1 \| tail -n 18'` → 0 → `Test Files 9 passed (9); Tests 307 passed (307)`. |
| Full shared predeploy gate | PASS (same unchanged current tree) | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 20'` → 0 → `Test Files 259 passed (259); Tests 2803 passed (2803); PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` This gate ran earlier in this QA cycle against the unchanged application/test tree; only QA reports/status/log entries changed since. |
| No-database bilingual `/chat` | PASS (same unchanged current tree) | `bash -lc 'set -o pipefail; echo "START"; bash scripts/claude/qa-serve.sh start; echo "GET_EN"; bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en; echo "GET_RO"; bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro; echo "STOP"; bash scripts/claude/qa-serve.sh stop'` → 0 → QA server ready/stopped; both requests `STATUS 200`, localized chat instructions and translated safe load-error states. |
| Live-provider checks (qa.md #6–#8) | NOT RUN | Require a configured real provider key and live service; QA did not access these resources. |

### Failures
None in this run. The previous predeploy PGlite hook timeouts are not reproducible on the
redelivered tree: the shared predeploy gate completed with all 259 test files and 2,803 tests
passing. The regression table and normalization test table passed without network access.

### For the user
- With your configured Gemini or Groq provider, try one Romanian and one English row from
  `test/fixtures/ai/chat-regression.json`, including an intentionally sloppy operation/field
  spelling; confirm it normalizes to the expected action.
- Try a genuinely invalid field, operation or period and confirm it still receives the closed-set
  error reply; paste instruction-like PDF/web text and confirm it is treated as data.

No application code or tests were changed. No live provider, key, database, migration, deployment
or Git operation was used. Denied or attempted prohibited commands: none in this run.
