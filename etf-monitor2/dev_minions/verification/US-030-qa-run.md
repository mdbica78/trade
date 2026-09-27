## QA run 1 — 2026-09-27 22:17
Verdict: BLOCKED
Machine checks: 1/2 completed   Left for the user: 3

Manual override: the user explicitly authorized QA while the development loop is paused.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | No-adapter, report-link, migration, deadline, recovery and UI checks (US-030 AC1–AC11) | AUTO | BLOCKED | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/ingestion/report-links.test.ts lib/ingestion/ingest-no-adapter.test.ts lib/ingestion/run-deadline.test.ts lib/ingestion/recovery.pglite.test.ts lib/monitoring/home-links.pglite.test.ts lib/cron/deadline.pglite.test.ts lib/config/etfs.report-link.pglite.test.ts app/chat/add-paths.pglite.test.ts test/helpers/pglite.migrations.test.ts … --reporter=dot --silent` → 1 → 277/278 tests passed; only `lib/cron/deadline.pglite.test.ts` beforeEach timed out at 10 seconds. |
| 2 | Isolated deadline/PGlite test | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/cron/deadline.pglite.test.ts --reporter=dot --silent` → 0 → `Test Files 1 passed (1)`; `Tests 1 passed (1)`. |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] Apply the `etf_report_links` migration to Neon before deploying Sprint 7, then verify the empty table exists.
- [LIVE-DB] Add a no-adapter ETF through both admin and chat, then verify its report link, visible unavailable marker, and daily-run outcome on production.
- [JUDGMENT] Confirm the no-adapter report-link and extraction-unavailable wording is appropriate in RO and EN.

### Blocker

- The focused concurrent PGlite run has a setup timeout in `lib/cron/deadline.pglite.test.ts`; the test passes alone. A clean focused/full retry is required before a PASS verdict. No application code or test was changed by QA.
