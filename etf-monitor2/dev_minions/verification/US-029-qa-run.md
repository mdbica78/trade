## QA run 1 — 2026-09-27 16:39
Verdict: BLOCKED
Machine checks: 2/3 completed   Left for the user: 3

Manual override: the user explicitly authorized QA while the development loop is at `WAITING-LIMIT`.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | ICBETNETF discovery, adapter, fixture, ingestion, catalogue and request-bound checks (AC1–AC10) | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/extraction/discovery.icbetnetf.test.ts lib/extraction/adapters/text.test.ts lib/extraction/adapters/intercapital-nav.test.ts lib/extraction/adapters/brd-depositary.test.ts lib/extraction/fixtures.test.ts lib/ingestion/request-bound.test.ts lib/ingestion/ingest-icbetnetf.pglite.test.ts lib/db/seed-data.test.ts lib/db/seed.pglite.test.ts app/api/cron/daily/route.test.ts app/chat/page.test.tsx app/admin/etfs/page.test.tsx --reporter=dot --silent` → 0 → `Test Files 12 passed (12)`; `Tests 232 passed (232)`. |
| 2 | Shared typecheck and full regression (all Awaiting-QA stories) | AUTO | BLOCKED | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck && env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test -- --silent` → 1 → 140/141 files, 1574/1575 tests; only `app/chat/page.safety.test.tsx` CPS-1 timed out at 5 seconds under concurrent load. |
| 3 | CPS-1 isolation | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run app/chat/page.safety.test.tsx --reporter=dot --silent` → 0 → `Test Files 1 passed (1)`; `Tests 5 passed (5)`. |

### For the user (only what a machine couldn't settle)

- [JUDGMENT] Confirm the ICBETNETF field labels and displayed values match the report in Romanian and English.
- [LIVE-DB] Seed Neon after deployment, add/re-detect ICBETNETF, track fields, and verify the next daily run against the linked PDF.
- [LIVE-ACCOUNT] Perform the deployed chat/provider checks recorded in US-028's QA run.

### Blocker

- The required full suite has a recurring, isolated CPS-1 concurrent-load timeout. The story-specific suite is green and CPS-1 passes alone, but a successful full-suite retry is still required before a PASS verdict. No product code or test was changed by QA.
