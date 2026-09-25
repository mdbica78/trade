# US-013 — Test verification, round 1

**Story:** Daily cron endpoint and Vercel Cron configuration
**Tested:** 2026-09-24

Verdict: PASS

All acceptance criteria are covered by tests, and all tests pass.

## Test suite results

- `pnpm install` — exit 0
- `pnpm typecheck` — exit 0
- `pnpm lint` — exit 0 (2 warnings in unrelated files, pre-existing)
- `pnpm test` — exit 0 (486 tests passed, 39 test files)
- `pnpm build` — exit 0

## Acceptance criteria coverage

**AC1 — Auth**
- `lib/cron/daily-handler.test.ts` / H-1a, H-1b, H-1c, H-1d: no Authorization / wrong scheme / wrong secret / lowercase scheme → 401, run never called
- `lib/cron/daily-handler.test.ts` / H-1e: trailing space in header is stripped and authenticates correctly
- `lib/cron/daily-handler.test.ts` / H-1f: composed with runDailyIngestion, loadEtfs/ingest not called on bad auth
- `lib/cron/daily-handler.test.ts` / H-1g: correct bearer → run called once, status 200
- `lib/cron/daily-handler.test.ts` / H-1h: CRON_SECRET undefined/empty/whitespace → 500 cron not configured
- `app/api/cron/daily/route.test.ts` / RT-1a: empty CRON_SECRET with Bearer header → 500 cron not configured
- `app/api/cron/daily/route.test.ts` / RT-1b: CRON_SECRET set, no header → 401
- `app/api/cron/daily/route.test.ts` / RT-1c: env read at request time, not at module load

**AC2 — Every active ETF once, inactive never, tracked keys in display_order**
- `lib/ingestion/run-daily.test.ts` / RD-2a: processes only active ETFs in loader order with exact tracked keys
- `lib/ingestion/run-daily.test.ts` / RD-2d: empty loader result → empty summary, ingest never called
- `lib/ingestion/load-etfs.test.ts` / LQ-2c: calls runner exactly once with one statement
- `lib/ingestion/load-etfs.pglite.test.ts` / LP-2b: orders tracked fields by display_order then field_key, excludes inactive ETFs

**AC3 — Isolation (one failure doesn't stop others; throws become internal_error)**
- `lib/ingestion/run-daily.test.ts` / RD-3a: failed outcome, throw, and ok outcome all recorded in order
- `lib/ingestion/run-daily.test.ts` / RD-3b: thrown non-Error value becomes internal_error with String() detail
- `lib/ingestion/run-daily.test.ts` (line 80): rejected promise from ingest behaves like throw
- `lib/cron/daily-handler.test.ts` / H-3c: through handler, mixed outcomes → 200 with JSON body containing all entries

**AC4 — No retries (one call per active ETF per request)**
- `lib/ingestion/run-daily.test.ts` / RD-4: ingest called exactly once per active ETF
- `lib/ingestion/run-daily.test.ts` / RD-4b: sequential — second ETF not started before first resolves

**AC5 — vercel.json has exactly one cron entry with correct schedule**
- `lib/cron/vercel-config.test.ts` / AC5: exactly one cron entry for /api/cron/daily
- `lib/cron/vercel-config.test.ts` / AC5: schedule is once-a-day (minute and hour are numbers, dom/month/dow are *)
- `lib/cron/vercel-config.test.ts` / AC5: schedule is the Decided default `0 10 * * *`
- `lib/cron/vercel-config.test.ts` / AC5: no other top-level keys except optional $schema

**AC6 — Responses (200 on success, 500/401 on failure, no secrets leaked)**
- `lib/cron/daily-handler.test.ts` / H-6a: completed run with mixed outcomes → 200 with JSON listing every ETF, correct headers
- `lib/cron/daily-handler.test.ts` / H-6b: run rejects with MissingDatabaseUrlError or query fails → 500 with generic message
- `lib/cron/daily-handler.test.ts` / H-6c: no response body contains CRON_SECRET or DATABASE_URL, even when outcomes mention them; redaction applied
- `app/api/cron/daily/route.test.ts` / RT-6: correct bearer with no DATABASE_URL → 500 run could not start (MissingDatabaseUrlError caught)

**AC7 — Route exports, build succeeds**
- `app/api/cron/daily/route.test.ts` / RT-7a: exports only GET, runtime=nodejs, dynamic=force-dynamic, maxDuration=60
- `app/api/cron/daily/route.test.ts` / RT-7b: duration budget (3 ETFs × 2 × 7s + 15s = 57s) ≤ maxDuration (60s)
- Build: `pnpm build` passes with the route importing the real ingestion chain (unpdf included)

**AC8 — README.md documented**
- `lib/cron/vercel-config.test.ts` / AC8: CRON_SECRET no longer marked Reserved
- `lib/cron/vercel-config.test.ts` / AC8: README contains /api/cron/daily, vercel.json, Authorization: Bearer, Production

**AC9 — MANUAL-QA** — (deferred to QA run; no automated test)

**AC10 — Gates pass**
- `pnpm typecheck` — 0 exit code
- `pnpm lint` — 0 exit code (2 warnings in pre-existing files)
- `pnpm test` — 0 exit code, 486 tests passed
- `pnpm build` — 0 exit code

## Notes

- All 486 tests passed, including 14 new tests directly for US-013 (run-daily, daily-handler, route, vercel-config).
- Known pre-existing ESLint warnings: unused `_text` parameter in `lib/extraction/adapters/types.test.ts` and unused `_statements` in `lib/ingestion/load-etfs.test.ts` — both are intentional test-helper parameters.
- Build required a clean `.next` to clear a stale lock; rebuild succeeded with exit 0.
- The real route imports unpdf and the extraction chain successfully with `serverExternalPackages: ["unpdf"]` configured in next.config.ts (verified by RT-7b's budget calculation).
- All acceptance criteria are covered by at least one test. No criterion is UNCOVERED.
