# US-057 QA run 1 — 2026-10-08

Verdict: FAIL

QA was continued under the user's explicit override although the development-loop status command
returned exit 1 (`STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far
away to wait`). The loop was not restarted. No secret values were printed; all database, cron,
master-key and provider-key variables were unset for `pnpm` checks.

## Machine checks

| Check | Result | Exact command and evidence |
|---|---|---|
| Development-loop gate | Override used | `bash scripts/claude/dev-loop-status.sh` → exit 1 → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. Rechecked before this story. |
| Frozen install | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm install --frozen-lockfile 2>&1 | tail -n 8'` → exit 0 → `Lockfile is up to date, resolution step is skipped; Done in 693ms using pnpm v12.5.1`. |
| Focused US-057 regression | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/config/custom-providers.test.ts lib/config/custom-providers.pglite.test.ts lib/config/custom-providers.boundary.test.ts lib/config/ai-keys.custom.test.ts lib/config/ai-keys.custom.pglite.test.ts lib/config/ai-settings.custom.test.ts lib/ai/key-binding.test.ts lib/ai/key-binding.pglite.test.ts lib/ai/providers/resolve.custom.test.ts lib/ai/provider-deps.custom.test.ts lib/ai/custom-provider.pglite.test.ts app/admin/ai/custom-provider-actions.test.ts components/admin/CustomProvidersAdmin.test.tsx lib/ai/providers/openai-compatible.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx app/admin/ai/page.test.tsx test/helpers/pglite.migrations.test.ts lib/db/schema.test.ts test/data-model-doc.test.ts lib/ai/provider-deps.custom.test.ts 2>&1 | tail -n 22'` → exit 0 → `Test Files 20 passed (20); Tests 231 passed (231)`. |
| Typecheck | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm typecheck 2>&1 | tail -n 8'` → exit 0 → `$ tsc --noEmit`, no errors. |
| Lint | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm lint 2>&1 | tail -n 12'` → exit 0 → `23 problems (0 errors, 23 warnings)`. |
| Full regression | FAIL | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm test 2>&1 | tail -n 24'` → exit 1 → `Test Files 2 failed | 251 passed (253); Tests 14 failed | 2739 passed (2753)`. The failures are in `lib/ai/chat.conversations.pglite.test.ts` and `lib/ai/chat.regression.test.ts`; US-056 QA run 1 already identified these as unfinished US-058 confirmation-flow/test-update fallout. |
| Offline build | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm build 2>&1 | tail -n 28'` → exit 0 → `Compiled successfully`; 12 dynamic routes, including `/admin/ai` and `/chat`. |
| `/admin/ai` and `/chat`, RO/EN, no database | FAIL / PASS | `bash -lc 'QA_PORT=3101 bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en; QA_PORT=3101 bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=ro; QA_PORT=3101 bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en; QA_PORT=3101 bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro'` → exit 0 → statuses in order: `500`, `500`, `200`, `200`; both chat pages show their translated safe load-error state. |
| Predeploy gate | NOT RUN | The full regression already failed; `predeploy-check.sh` reruns that same full-suite gate and would not establish a different result. |
| Schema generation check | NOT RUN | `pnpm db:generate` may write generated migration files, outside QA's permitted write scope. No migration or database was touched. |

The first frozen-install attempt used a non-login shell and could not find pnpm:
`bash -o pipefail -c 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm install --frozen-lockfile 2>&1 | tail -n 8'`
→ exit 127 → `env: ‘pnpm’: No such file or directory`. Retrying through `bash -lc` passed.

The QA helper's `start` subcommand was not used because its cleanup function calls `pkill -f`.
Instead, the production server was started directly and the QA helper's read-only `get` command was
used. The server was started by
`bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec next start -H 127.0.0.1 -p 3101'`.
Cleanup command:
`$listener = Get-NetTCPConnection -LocalPort 3101 -State Listen -ErrorAction SilentlyContinue; $listener | Select-Object LocalAddress,LocalPort,OwningProcess; if ($listener) { $listener | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } }`
reported listener PID `47596`, then `Stop-Process -Id 47596 -Force` returned `Access is denied`.
No alternate termination command was attempted. A later port probe returned `True`, so the QA
server may remain running on port 3101.

## Failures and exact unblock instructions

1. **`/admin/ai` returns HTTP 500 in both locales without a database.** In
   `lib/ai/provider-deps.ts`, `getCustomProviderViews` calls `getDb()` at line 121 before entering
   its `try` at line 124. Move database acquisition and dependent setup inside the guarded block so
   the existing catch returns `{ status: "error" }` and logs safely when `DATABASE_URL` is absent.
   Add a regression test for the missing-database path; rerun the focused custom-provider tests,
   typecheck, full suite, and English/Romanian no-database `/admin/ai` checks, which should render
   the localized load-error state with HTTP 200 rather than throw. This is a product blocker for
   US-057 and also the known US-056 blocker.
2. **Full suite has 14 failures from US-058's unfinished shared chat changes.** Finish US-058's
   planned confirmation/correction implementation and deliberate test updates (especially the
   call-count and plan-refusal expectations described in `HANDOVER.md`), then rerun
   `pnpm test` and `bash scripts/claude/predeploy-check.sh`. Do not attribute those test failures
   to US-057's custom-provider tests; its focused suite passed.

## For the user

Live steps require the deployed app and a real provider key; no live resource or key was used:

- M-1: after deployment, confirm `/health` has no missing-table report for migration
  `0005_ai_custom_providers`.
- M-2: in `/admin/ai`, add a custom Groq provider at `https://api.groq.com/openai/v1`, enter your
  own key, select model `openai/gpt-oss-120b`, save, and test the connection; expect success.
  Then test a harmless `/chat` request.
- M-3: change the address to `https://api.groq.com/openai/v2`; confirm the key is removed and
  Test connection reports `no_api_key`. Restore the address and re-enter the key yourself.
- M-4: verify refusal of `http://…`, loopback/private hosts, `.internal`, and query-string URLs;
  add five providers and verify a sixth is refused.
- M-5: delete a provider and verify its row/key disappear; if it was active, verify the existing
  unsupported-provider notice and unavailable chat behavior.

No Git, live provider, real key, Neon, Vercel, migration application, or deployment command was
used. Files changed by QA: this report, the US-057 status-board row, and the Codex QA log section
in `HANDOVER.md`.

## QA run 2 — 2026-10-09
Verdict: PASS
Machine checks: offline gates and no-database bilingual route checks PASS; live steps remain for
the user.

The user-authorized QA override was used although the dev-loop status reported
`STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`.
The dev loop was not restarted. Database, cron, master-key and provider-key environment variables
were unset for checks; no values were printed.

| Check | Result | Exact command → exit code → output |
|---|---|---|
| Development-loop gate | Override used | `bash -lc 'bash scripts/claude/dev-loop-status.sh; printf "GATE_EXIT=%s\n" "$?"'` → 0 (wrapper; inner status printed STOPPED) → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. |
| Focused US-057 custom-provider suite | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/config/custom-providers.test.ts lib/config/custom-providers.pglite.test.ts lib/config/custom-providers.boundary.test.ts lib/config/ai-keys.custom.test.ts lib/config/ai-keys.custom.pglite.test.ts lib/config/ai-settings.custom.test.ts lib/ai/key-binding.test.ts lib/ai/key-binding.pglite.test.ts lib/ai/providers/resolve.custom.test.ts lib/ai/provider-deps.custom.test.ts lib/ai/custom-provider.pglite.test.ts app/admin/ai/custom-provider-actions.test.ts components/admin/CustomProvidersAdmin.test.tsx lib/ai/providers/openai-compatible.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx app/admin/ai/page.test.tsx test/helpers/pglite.migrations.test.ts lib/db/schema.test.ts test/data-model-doc.test.ts 2>&1 \| tail -n 22'` → 0 → `Test Files 20 passed (20); Tests 234 passed (234)`. |
| Full shared predeploy gate | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 20'` → 0 → `Test Files 259 passed (259); Tests 2803 passed (2803); PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` This gate re-ran typecheck, lint, offline build and the full suite on the stable current tree. |
| English/Romanian `/admin/ai` without database | PASS | `bash -lc 'set -o pipefail; echo "START"; bash scripts/claude/qa-serve.sh start; echo "GET_EN"; bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en; echo "GET_RO"; bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=ro; echo "STOP"; bash scripts/claude/qa-serve.sh stop'` → 0 → server ready/stopped; both locales `STATUS 200`, localized safe load-error text and provider/key status area rendered; no Test connection button while settings are unavailable. |
| `pnpm db:generate` (qa.md #6) | NOT RUN | This can create migration files outside QA's permitted write scope; no database or migration was touched. |
| Live/manual M-1 through M-5 | NOT RUN | These require the deployed app and/or user-owned keys/accounts; not accessed by QA. |

### Failures
None. QA run 1's `/admin/ai` 500 responses and shared chat failures are no longer reproducible:
the localized requests now return 200, and the current full suite/predeploy gate passes.

### For the user
- **M-1**: after deployment, confirm `/health` has no missing-table report for migration
  `0005_ai_custom_providers`.
- **M-2/M-3**: use your own Groq key to add a custom Groq provider, test a successful request, then
  change its URL and confirm the bound key is removed and `no_api_key` is shown.
- **M-4**: verify the URL rejection table and five-provider cap in the deployed admin UI.
- **M-5**: delete a custom provider and confirm its key disappears; if selected, verify the setting
  remains unchanged and the unsupported-provider notice appears.

No application code or tests were changed. No live service, real key, migration, deployment or Git
operation was used. Denied or attempted prohibited commands: none in this run.

## Live check by the user — 2026-10-09
Verdict: **FAIL** (reopened).

### Failures
1. The custom provider stops working. After changing, deleting and re-adding it, every request returns
   "The AI provider does not know this model. Check the model name in Administration → AI."
   (`model_not_found`). Expected: a custom provider answers with its own model, or the user is told a
   model is required.
   Likely cause (not confirmed): a custom provider has no model of its own and uses the global
   `settings.ai_model`, which still holds the model of the previously selected provider (see US-041).
   Plan decision D-2 also leaves `settings` untouched when the active custom provider is deleted,
   which keeps a stale provider/model pair.
   Fix to consider: store a model per custom provider, or reset `ai_model` when the provider changes
   or is deleted. Add a PGlite test of add → select → set model → test → delete → re-add.
