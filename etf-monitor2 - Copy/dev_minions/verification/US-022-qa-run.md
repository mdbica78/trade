## QA run 1 - 2026-09-26 15:25
Verdict: PASS
Machine checks: 4/4 AUTO+AUTO-PARTIAL passed. Left for the user: 2

The development-loop gate passed before this story: `bash scripts/claude/dev-loop-status.sh` -> exit 0 -> `RUNNING 2026-09-26 13:51:30 - run 2`.

| # | Check (source) | Type | Result | Evidence (command -> exit code -> output tail) |
|---|---|---|---|---|
| 1 | Provider choice, settings persistence/validation, key-status privacy, no-network boundaries, bilingual UI and error paths (AC1-AC7) | AUTO | PASS | `env -u DATABASE_URL pnpm exec vitest run lib/ai/provider-catalog.test.ts lib/ai/key-status.test.ts lib/ai/boundaries.test.ts lib/ai/env-example.test.ts lib/config/ai-settings.test.ts lib/config/ai-settings.pglite.test.ts lib/config/boundaries.test.ts app/admin/ai/page.test.tsx app/admin/ai/actions.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx app/admin/layout.test.tsx i18n/messages.test.ts --reporter=dot --silent` -> exit 0 -> `Test Files 13 passed (13); Tests 93 passed (93)`. |
| 2 | Project typecheck and full regression suite (AC8) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck && env -u DATABASE_URL pnpm test -- --silent` -> exit 0 -> `Test Files 93 passed (93); Tests 1078 passed (1078)`. Existing PDF/parser and next-intl notices were emitted during tests, but no test failed. |
| 3 | Lint and offline production build (AC8) | AUTO | PASS | `env -u DATABASE_URL pnpm lint && env -u DATABASE_URL pnpm build` -> exit 0 -> lint reported `0 errors, 3 warnings` in existing unrelated test files; build compiled successfully and listed `/admin/ai`. |
| 4 | Local AI page, Romanian and English, with no database (MQ-2) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL bash scripts/claude/qa-serve.sh start`; `get /admin/ai`; `get /admin/ai NEXT_LOCALE=en`; `stop` -> exit 0 -> both requests returned `STATUS 200`, translated safe load-error states, the four key-variable names and only `not set` markers; neither response exposed a value; `QA server stopped.` |

### For the user (only what a machine couldn't settle)

- [LIVE-DB/LIVE-ACCOUNT] On deployed `/admin/ai`, save a provider and model; in Neon confirm only `ai_provider`/`ai_model` changed. Set that provider's Vercel environment variable, redeploy, and confirm the page shows `set` but never the value. Then clear the provider and confirm both database columns are NULL.
- [JUDGMENT] Confirm the shipped product decision: provider keys stay as Vercel environment variables; this page reports only set/unset and does not accept an in-app key.

No US-022 failure was found. The no-database page state is expected in this offline QA environment.
