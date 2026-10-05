## QA run 1 — 2026-10-04 18:20
Verdict: PASS
Machine checks: 7/7   Left for the user: 3

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (database/deploy/key variables removed; earlier this QA cycle) → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.1s`. |
| 2 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (same variables removed, earlier this QA cycle) → 0 → `$ tsc --noEmit`. |
| 3 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (same variables removed, earlier this QA cycle) → 0 → `9 problems (0 errors, 9 warnings)`. |
| 4 | Full suite (qa.md #1) | AUTO | PASS | `pnpm test` (same variables removed, earlier this QA cycle) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 5 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` (same variables removed, earlier this QA cycle) → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes. |
| 6 | Focused multi-action/widget/chat/PGlite/reply/boundary regression (qa.md #2; AC1–AC6, AC8) | AUTO | PASS | `bash -lc 'pnpm exec vitest run lib/ai/capabilities/action-list.test.ts lib/ai/capabilities/widgets/intent.test.ts lib/ai/capabilities/widgets/execute.pglite.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts app/chat/reply-messages.test.ts components/chat/ChatView.test.tsx lib/ai/capabilities/boundaries.test.ts app/actions.boundary.test.ts'` (eleven variables removed) → 0 → `Test Files 9 passed (9); Tests 177 passed (177)`; PGlite mixed-action/no-write tests passed. |
| 7 | RO/EN widget instructions, limit, safe reply text (qa.md #3; AC7) | AUTO-PARTIAL | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh get /chat'` → 0 → `STATUS 200`, RO four widget operations and `mai mult de cinci acțiuni`; `bash -lc 'bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en'` → 0 → `STATUS 200`, EN `Add`, `Update`, `Clear`, `Replace custom history values` and `more than five actions`. These requests were executed earlier this QA cycle against the same no-DB app; `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0. The focused `app/chat/reply-messages.test.ts` (48 tests) covers localized `done`/`failed`/`not_run` responses, and the current `lib/ai/chat.test.ts` (47 tests) covers pre-provider key refusal and returned config errors. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm drafted AC1–AC8 and live provider interpretation of mixed requests; the automated parser and config behavior are tested offline with fakes.
- [LIVE-DB] After normal push and optional provider setup, try add/update/clear/replace against an ETF's catalogue fields, verify persisted widget results and basis dates on its detail page without entering a key into chat.
- [LIVE-ACCOUNT] If a provider is already configured, try one mixed configuration/widget request and a six-action refusal. Do not enter a real key in chat, tests or an agent transcript.

### Failures (if any)
- None. The no-database app does not render a usable chat composer, so live-provider interpretation is not claimed as QA evidence.

No git, real database, live provider, migration, secret value, or Vercel resource accessed. No source/tests edited.
