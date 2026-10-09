## QA run 1 — 2026-10-08 07:56
Verdict: FAIL
Machine checks: 5/10   Left for the user: 3

All `pnpm` commands ran in `bash -lc` with this prefix:
`env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY`.
No variable values were printed. The user-authorized QA override was used despite the development-loop gate reporting STOPPED; the development loop was not restarted.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 637ms using pnpm v12.5.1`. |
| 2 | Focused US-056 regression (qa.md #2) | AUTO | PASS | `pnpm exec vitest run lib/ai/providers/presets.test.ts lib/ai/connection-test.test.ts lib/ai/provider-presets.pglite.test.ts app/admin/ai/test-connection.flow.test.tsx lib/ai/provider-catalog.test.ts lib/ai/providers/openai-compatible.test.ts lib/ai/provider-deps.interchange.test.ts app/admin/ai/actions.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx components/admin/AiProviderModelFields.test.tsx app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx lib/ai/boundaries.test.ts lib/config/boundaries.test.ts` → 0 → `Test Files 15 passed (15); Tests 288 passed (288)`. |
| 3 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` → 0 → `$ tsc --noEmit`, no errors. |
| 4 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` → 0 → `✖ 23 problems (0 errors, 23 warnings)`. This is 10 more warnings than the checklist’s expected 13; the extra warnings are in other changed/in-progress files, including chat-history and custom-provider tests. |
| 5 | Full regression (qa.md #1) | AUTO | FAIL | `pnpm test` → 1 → failing files: `lib/ai/chat.conversations.pglite.test.ts` (D08, D10) and `lib/ai/chat.regression.test.ts` (R01, R03, R04, R08, R09, R23, R25–R28); predeploy rerun summary: `Test Files 2 failed | 251 passed (253); Tests 14 failed | 2739 passed (2753)`. |
| 6 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` → 0 → `migrate-on-deploy: skipped (not a production build)`; build completed and listed 12 dynamic routes. |
| 7 | Predeploy gate (qa.md #1) | AUTO | FAIL | `bash scripts/claude/predeploy-check.sh` → 1 → `PREDEPLOY: FAIL at 'pnpm test' — do not push.` Typecheck, lint and build completed before the test gate. |
| 8 | English and Romanian `/admin/ai` no-database responses (qa.md #2) | AUTO-PARTIAL | FAIL | `bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en` → command 0, HTTP `STATUS 500`; same command with `NEXT_LOCALE=ro` → command 0, HTTP `STATUS 500`. QA server log records `[load-error] ai/custom-providers name=MissingDatabaseUrlError` followed by `[load-error] ai/provider-keys name=MissingDatabaseUrlError`, then an uncaught `MissingDatabaseUrlError` (digest `1336708885`). Server stopped. |
| 9 | Test Connection absent on settings-load-error page (qa.md #3) | AUTO | BLOCKED | Cannot inspect the expected load-error page because both locale requests to `/admin/ai` return HTTP 500. The checklist’s expected page state is not rendered. |
| 10 | `pnpm db:generate` produces no migration (qa.md #7) | NOT-AUTOMATABLE | NOT RUN | Not run: this command may create migration files, which are outside QA’s permitted write scope. |

### For the user
- [LIVE-ACCOUNT] M-1: use the deployed `/admin/ai` page and a real key entered by you to test a new provider’s suggested model, a nonsense model, and an invalid key; verify only closed error codes appear.
- [LIVE-ACCOUNT] M-2: test Groq’s `openai/gpt-oss-120b` suggestion and a US-053 `/chat` transcript phrase.
- [LIVE-ACCOUNT] M-3: optionally test each new preset for which you have a key. Never send keys to QA or put them in chat/tests.

### Failures
- #5/#7: the current shared tree fails 14 chat assertions in two suites. D08/D10 and R25–R28 now observe a second provider call; the transcript/configuration rows R01/R03/R04/R08/R09/R23 receive `plan_refused` instead of `executed_actions`. These failures occur in chat conversation/regression coverage while US-058 is recorded as in implementation. Complete the US-058 implementation and its deliberate test updates, then rerun `pnpm test` and `bash scripts/claude/predeploy-check.sh`.
- #8/#9: `/admin/ai` is inaccessible without a database in both locales. Current source evidence points to `lib/ai/provider-deps.ts`: `getCustomProviderViews` obtains `getDb()` before entering its `try`, so a missing `DATABASE_URL` escapes despite the safe-error handling in the page. Fix the owning implementation, then rerun both locale checks and confirm the button is absent on the error state. The same route blocker must be considered when QAing US-057.

QA server was stopped. No live provider, real key, Neon, Vercel, migration, deployment, or Git operation was used. Files changed by QA: this report, the US-056 Story board row in `dev_minions/status.md`, and an append to the QA/Deploy log in `dev_minions/HANDOVER.md`. No denied or attempted prohibited commands.

## QA run 2 — 2026-10-09
Verdict: PASS
Machine checks: all executable offline checks passed; live provider checks remain for the user.

The user-authorized QA override was used although `bash scripts/claude/dev-loop-status.sh`
reported `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to
wait`. The development loop was not restarted. All database, cron, master-key and provider-key
variables were unset for the pnpm checks; no variable values were printed.

| Check | Result | Exact command → exit code → output |
|---|---|---|
| Development-loop gate | Override used | `bash -lc 'bash scripts/claude/dev-loop-status.sh; printf "GATE_EXIT=%s\n" "$?"'` → 0 (wrapper; inner status printed STOPPED) → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. |
| Frozen install | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm install --frozen-lockfile 2>&1 \| tail -n 8'` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 647ms using pnpm v12.5.1`. |
| Focused US-056 regression | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/ai/providers/presets.test.ts lib/ai/connection-test.test.ts lib/ai/provider-presets.pglite.test.ts app/admin/ai/test-connection.flow.test.tsx lib/ai/provider-catalog.test.ts lib/ai/providers/openai-compatible.test.ts lib/ai/provider-deps.interchange.test.ts app/admin/ai/actions.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx components/admin/AiProviderModelFields.test.tsx app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx lib/ai/boundaries.test.ts lib/config/boundaries.test.ts 2>&1 \| tail -n 20'` → 0 → `Test Files 15 passed (15); Tests 291 passed (291)`. |
| Typecheck | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm typecheck 2>&1 \| tail -n 8'` → 0 → `$ tsc --noEmit`, no errors. |
| Lint | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm lint 2>&1 \| tail -n 10'` → 0 → `23 problems (0 errors, 23 warnings)`. |
| Full regression | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm test 2>&1 \| tail -n 22'` → 0 → `Test Files 259 passed (259); Tests 2803 passed (2803)`. |
| Offline build | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm build 2>&1 \| tail -n 24'` → 0 → `Compiled successfully`; migration skipped outside production; 12 dynamic routes. |
| Predeploy gate | PASS (serial retry) | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 20'` → 0 → `Test Files 259 passed (259); Tests 2803 passed (2803); PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` |
| English/Romanian no-database `/admin/ai` and Test Connection state | PASS | `bash -lc 'set -o pipefail; echo "START"; bash scripts/claude/qa-serve.sh start; echo "GET_EN"; bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en; echo "GET_RO"; bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=ro; echo "STOP"; bash scripts/claude/qa-serve.sh stop'` → 0 → server ready/stopped; both requests `STATUS 200`, localized safe load-error text, all eight presets and environment-key statuses shown; no endpoint input or Test Connection button is rendered in this settings-load-error state. |
| `pnpm db:generate` (qa.md #7) | NOT RUN | QA may not run a command that can write migration files outside its permitted scope. No migration or database was touched. |
| Live provider checks M-1/M-2/M-3 | NOT RUN | Require user-owned live accounts/keys and deployment; no credentials or live services were accessed. |

An initial predeploy run overlapped the standalone build and failed at typecheck because `.next/types`
files were concurrently regenerated (`TS6053`). The gates were rerun serially: standalone predeploy
passed, including its own typecheck, build, and full regression suite. This was test/build
contention, not a product failure.

### Failures
None in the final serial run. QA run 1's missing-database `/admin/ai` failure and US-058-related
chat regression failures are resolved in the redelivered tree and verified by the current route
checks and full suite.

### For the user
- **M-1**: on the deployed app, test a new provider using your own key and a suggested model, then a
  nonsense model and invalid key; confirm only closed error codes appear and no key/raw response is
  exposed.
- **M-2**: test Groq's `openai/gpt-oss-120b` suggestion and a harmless `/chat` request.
- **M-3**: optionally test any other preset for which you already have an account/key.

No application code or tests were changed. No live provider, real key, Neon, Vercel, migration,
deployment, or Git operation was used. Denied or attempted prohibited commands: none.

## Live check by the user — 2026-10-09
Verdict: **FAIL** (reopened).

### Failures
1. "Test connection" answers "Connection OK: the provider answered." whatever provider is selected
   in the form. Only after Save and then Test does it report "connection failed".
   Expected: Test connection tests what the user sees, or the UI says plainly that it tests the saved
   settings. Cause (confirmed in code, read-only): `testConnectionAction` in `app/admin/ai/actions.ts`
   ignores its form data, and `testProviderConnection` in `lib/ai/connection-test.ts` loads the stored
   active provider through `loadActiveProvider`. So an unsaved selection is never tested, and "OK" refers
   to the previously saved provider.
2. "Failed after Save" is probably the model carried over from the previous provider (one global
   `settings.ai_model`), so the new provider answers `model_not_found`. See the US-041 live failure.
Fix to consider: pass the form's provider and model to the test, or disable the button while the form
differs from the saved state; show which provider and model were tested in the result message.
Add a test where the form selection differs from the stored one.
