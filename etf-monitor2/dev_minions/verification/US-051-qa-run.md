## QA run 1 — 2026-10-05 11:48
Verdict: PASS
Machine checks: 7/7 AUTO and AUTO-PARTIAL   Left for the user: 1

All check processes removed `DATABASE_URL`, `CRON_SECRET`, `AI_KEY_MASTER_KEY`,
`VERCEL_ENV`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` and
`MISTRAL_API_KEY` without printing any value. No AI provider call was made.

| # | Check (source) | Type | Result | Evidence (exact command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm install --frozen-lockfile'` → 0 → `Lockfile is up to date, resolution step is skipped; Done in 691ms using pnpm v12.5.1`. |
| 2 | Multi-action execution, capability registry, golden reply/markup and secret boundaries (AC2–AC5, qa.md #2/#4) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts app/chat/reply-messages.golden.test.ts components/chat/chat-markup.golden.test.tsx app/chat/reply-messages.test.ts lib/ai/capabilities/action-list.test.ts lib/ai/capabilities/registry.test.ts lib/ai/capabilities/configuration/interpret.test.ts lib/ai/capabilities/widgets/intent.test.ts lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts lib/config/boundaries.test.ts app/actions.boundary.test.ts app/chat/actions.test.ts app/chat/page.test.tsx'` → 0 → `Test Files 15 passed (15); Tests 342 passed (342)`. Golden snapshots matched without `-u`; CE-W1/CE-W2 in `chat.test.ts` cover the allowed C10 widget-context change. |
| 3 | Typecheck (AC1, qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm typecheck'` → 0 → `$ tsc --noEmit`. |
| 4 | Lint (AC1, qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm lint'` → 0 → `11 problems (0 errors, 11 warnings)`. |
| 5 | Full regression (AC1, qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm test'` → 0 → `Test Files 222 passed (222); Tests 2285 passed (2285)`. |
| 6 | Offline build (AC1, qa.md #1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build'` → 0 → `migrate-on-deploy: skipped (not a production build)`, `Compiled successfully in 9.6s`, 12 dynamic routes. |
| 7 | RO/EN `/chat`, `/admin/ai`, and other route spot checks (qa.md #2/#3, AC4) | AUTO-PARTIAL | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY bash scripts/claude/qa-serve.sh start'` → 0 → `QA server ready ... (database: none)`. For `ro` and `en`, `bash -lc "bash scripts/claude/qa-serve.sh get $route NEXT_LOCALE=$locale"` → 0, `STATUS 200` for each of `/`, `/etf/BTBETRETF`, `/admin`, `/admin/etfs`, `/admin/ai`, `/admin/cron`, `/admin/operations`, `/chat` (16 route responses). RO/EN `/admin/ai` displayed Gemini/Groq key-free `none` statuses, disabled-storage note and safe no-DB settings error. Browser `/chat` in EN and then RO displayed eight supported instructions, five-action cap, no-keys-in-chat guidance with `/admin/ai` link, and safe localized no-DB error. Without DB/provider there is no chat input with which to reproduce runtime key-request or mixed-action replies; those are verified by golden and mocked tests. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` |

### For the user
- [JUDGMENT] On a normally configured instance after the ordinary push, do `/chat` and `/admin/ai` still look and behave the same? The offline no-DB states and the pre-refactor golden snapshots passed. AC1–AC6 are drafted for PO confirmation.

No live provider, Neon, Vercel setting, real key, production migration or deployment was
accessed. Files changed by QA: `dev_minions/verification/US-051-qa-run.md`, US-051 row
in `dev_minions/status.md`, and the QA/Deploy log append in `dev_minions/HANDOVER.md`.
Denied or attempted commands: none.
