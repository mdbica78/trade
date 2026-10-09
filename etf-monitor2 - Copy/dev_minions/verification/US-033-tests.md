# US-033 — Test Verification (Round 1)

**Story:** Diagnosable load failures and schema-drift visibility  
**Sprint:** 8  
**Tested:** 2026-09-28  

Verdict: **PASS**

## Test execution summary

```
pnpm install --frozen-lockfile          exit 0
pnpm typecheck                          exit 0
pnpm lint                               exit 0 (0 errors, 9 pre-existing warnings)
pnpm test                               exit 0 (Test Files: 162 passed, Tests: 1743 passed)
pnpm build                              exit 0
```

All commands passed with expected output. No new failures or failures specific to this story.

## Acceptance criteria → tests

### AC1 — Safe log line (no secrets, no URLs, only validated fields)
**Status: MET**

Test file: `lib/log/load-error.test.ts`

- **LE-1** (lib/log/load-error.test.ts:7) — Drizzle-style wrapper: outer name kept, inner code/relation surfaced
- **LE-2** (lib/log/load-error.test.ts:130) — logLoadError prints exactly one safe line with no secret fragments
- **LE-3** (lib/log/load-error.test.ts:20) — Invalid codes are dropped
- **LE-4** (lib/log/load-error.test.ts:29) — Invalid relations are dropped
- **LE-5** (lib/log/load-error.test.ts:45) — A valid `table` field wins over the message; falls back to the message pattern
- **LE-6** (lib/log/load-error.test.ts:53) — Cause walk — 3rd cause level reported, 4th level not
- **LE-6b** (lib/log/load-error.test.ts:66) — A cyclic cause terminates
- **LE-7** (lib/log/load-error.test.ts:72) — Non-Error / unsafe names fall back to Unknown
- **LE-8** (lib/log/load-error.test.ts:91) — Never throws even when code/cause/message getters throw
- **LE-9** (lib/log/load-error.test.ts:148) — DATABASE_URL never read from the environment
- **LE-10** (lib/log/load-error.test.ts:155) — An unsafe scope is sanitised to 'unknown'

### AC2 — Pages log but do not leak (11 catch sites)
**Status: MET**

Test files: Multiple page test files

- **LE-P1** (app/page.test.tsx:83) — Home page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe home line
- **LE-P2** (app/etf/[symbol]/page.test.tsx:162) — ETF detail page: a sentinel-bearing loader error logs exactly one safe etf-detail line and never leaks it
- **LE-P2n** (app/etf/[symbol]/page.test.tsx:181) — ETF detail page: the not-found path logs nothing
- **LE-P5** (app/chat/page.load-error.test.tsx:32) — Chat page: getDb() throwing inside getChatAvailability logs exactly one safe chat line and shows the translated error
- **LE-P6** (app/admin/etfs/page.test.tsx:93) — Admin ETFs page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/etfs line
- **LE-P7** (app/admin/etfs/[symbol]/fields/page.test.tsx:110) — Admin ETF fields page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/etf-fields line
- **LE-P7n** (app/admin/etfs/[symbol]/fields/page.test.tsx:134) — Admin ETF fields page: the not-found path logs nothing
- **LE-P8** (app/admin/ai/page.test.tsx:176) — Admin AI page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/ai line (key table still renders)
- **LE-P9** (app/admin/cron/page.test.tsx:119) — Admin cron page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/cron line (effective window still renders)
- **LE-P10** (app/admin/operations/page.test.tsx:65) — Admin operations page: a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/operations line
- **LE-C1** (lib/ai/chat.test.ts:50) — Chat availability: a sentinel-bearing throw from the deps factory logs exactly one safe chat line and returns status error
- **HP-F4** (app/health/page.failure.test.tsx:92) — Health page: getDb() throwing a sentinel-bearing error logs exactly one safe health line
- **HC-6** (lib/health.test.ts:160) — Health status: a sentinel-bearing rejection logs one safe line and never leaks it in the status

### AC3 — /health names a stale schema (DEC-019 §2)
**Status: MET**

Test files: `lib/health.pglite.test.ts`, `app/health/page.schema.pglite.test.tsx`, `lib/health.test.ts`, `app/health/page.test.tsx`

- **HS-1** (lib/health.pglite.test.ts:19) — Fully migrated schema has no missing tables
- **HS-2** (lib/health.pglite.test.ts:30) — A dropped table is named
- **HS-3** (lib/health.pglite.test.ts:40) — The table list is derived, no hand-kept list
- **ST-1** (lib/health.test.ts:26) — schemaTableNames matches the last migration snapshot's table names
- **HC-5** (lib/health.test.ts:137) — Counts resolve but the schema probe never settles — still times out at HEALTH_QUERY_TIMEOUT_MS
- **HP-S1** (app/health/page.schema.pglite.test.tsx:56) — A dropped table shows the stale-schema warning
- **HP-S2** (app/health/page.schema.pglite.test.tsx:75) — A fully migrated schema shows no warning
- **HP-S3** (app/health/page.test.tsx:77) — A stale schema status renders the warning and the missing table names

### AC4 — Home falls back only for the optional join (DEC-019 §3)
**Status: MET**

Test file: `lib/monitoring/home-fallback.pglite.test.ts`

- **HF-1** (lib/monitoring/home-fallback.pglite.test.ts:69) — Dropping etf_report_links keeps the loader's result identical and logs one safe line
- **HF-2** (lib/monitoring/home-fallback.pglite.test.ts:91) — Dropping reports (etf_report_links present) rejects without retry and logs nothing from the loader
- **HF-3** (lib/monitoring/home-fallback.pglite.test.ts:104) — A wrong code (42703) is not treated as the missing-table case
- **HF-4** (lib/monitoring/home-fallback.pglite.test.ts:114) — 42P01 on a different relation (reports) is not treated as the missing-table case
- **HF-5** (lib/monitoring/home-fallback.pglite.test.ts:122) — The retry itself failing propagates the second error, one home/report-links line total
- **HF-6** (lib/monitoring/home-fallback.pglite.test.ts:137) — The normal path (table present) makes exactly one call and logs nothing
- **HF-7** (lib/monitoring/home-fallback.pglite.test.ts:148) — buildReportOnlyLinksStatement equals buildLatestReportLinksStatement when no link rows exist

### AC5 — No new secret path (AGENTS.md secrets rule)
**Status: MET**

Test file: `app/load-error.boundary.test.ts`

- **LB-E0** (app/load-error.boundary.test.ts:87) — Exactly the 8 expected page.tsx files contain a catch clause (not a vacuous pass)
- **LB-E1** (app/load-error.boundary.test.ts:92) — Every catch binds a variable and calls logLoadError with the right scope; no console. anywhere
- **LB-E2** (app/load-error.boundary.test.ts:107) — Every page.tsx that imports @/lib/db also calls logLoadError(
- **LB-E3** (app/load-error.boundary.test.ts:118) — chat.ts, health.ts and home.ts each log through their documented scope
- **LB-E4** (app/load-error.boundary.test.ts:128) — lib/log/load-error.ts is pure — no process.env, no .stack, exactly one console.error(, no import
- **LB-E5** (app/load-error.boundary.test.ts:137) — console. appears in non-test lib/ sources only in load-error.ts and the pre-existing daily-handler.ts; nowhere in app/**

### AC6 — Bilingual and gates
**Status: MET**

- **Messages verified:** 
  - `messages/en.json`: `Health.schemaStale` = "Database schema out of date: run pnpm db:migrate. Missing tables:"
  - `messages/ro.json`: `Health.schemaStale` = "Schema bazei de date nu este la zi: rulați pnpm db:migrate. Tabele lipsă:"
  - Message parity test (i18n/messages.test.ts) passes, verifies both locales have matching keys
  
- **Gates passed:**
  - `pnpm typecheck`: exit 0
  - `pnpm lint`: exit 0 (0 errors)
  - `pnpm build`: exit 0 (offline, DATABASE_URL unset)
  - `pnpm test`: exit 0 (all tests pass with variables unset)

### AC7 — README deployment instructions
**Status: MET**

Test file: `test/readme-deployment.test.ts`

- **RD-D1** (test/readme-deployment.test.ts:24) — The Deployment section has the bold migrate-first sentence before the deploy step, and the exact schema-check code
- **RD-D2** (test/readme-deployment.test.ts:44) — The Health check section mentions pnpm db:migrate and [load-error]
- **MANUAL-QA (user):** After migrating Neon and redeploying, open `/health`: no schema line if migrated. If schema is behind, the line names the missing table(s). Vercel → Logs: a failing page shows one `[load-error] <scope> name=… code=… relation=…` line and nothing else about the error.

## Files evidence

### New files (implementation)
- `lib/log/load-error.ts` — Core helper: `describeLoadError(error)`, `logLoadError(scope, error)`
- `lib/health.pglite.test.ts` — Health PGlite tests (HS-1, HS-2, HS-3)
- `lib/monitoring/home-fallback.pglite.test.ts` — Home fallback tests (HF-1..HF-7)
- `app/health/page.schema.pglite.test.tsx` — Health page schema tests (HP-S1, HP-S2)
- `app/chat/page.load-error.test.tsx` — Chat page load-error test (LE-P5)
- `app/load-error.boundary.test.ts` — Boundary test for load-error logging (LB-E0..LB-E5)
- `test/helpers/pglite-drizzle.ts` — PGlite drizzle helper for tests
- `test/readme-deployment.test.ts` — README deployment test (RD-D1, RD-D2)

### Modified files (implementation)
- `lib/health.ts` — Added `schemaTableNames()`, `buildSchemaProbeStatement()`, schema probe in `getHealthStatus()`
- `lib/monitoring/home.ts` — Added `buildReportOnlyLinksStatement()`, `isMissingReportLinksTable()`, fallback in `createHomeTableLoader()`
- `lib/ai/chat.ts` — Added `logLoadError("chat", error)` in `getChatAvailability` catch
- `app/page.tsx` — Added `logLoadError("home", error)` in catch
- `app/etf/[symbol]/page.tsx` — Added `logLoadError("etf-detail", error)` in catch
- `app/health/page.tsx` — Added schema-stale warning rendering, `logLoadError("health", error)` in catch
- `app/admin/etfs/page.tsx` — Added `logLoadError("admin/etfs", error)` in catch
- `app/admin/etfs/[symbol]/fields/page.tsx` — Added `logLoadError("admin/etf-fields", error)` in catch
- `app/admin/ai/page.tsx` — Added `logLoadError("admin/ai", error)` in catch
- `app/admin/cron/page.tsx` — Added `logLoadError("admin/cron", error)` in catch
- `app/admin/operations/page.tsx` — Added `logLoadError("admin/operations", error)` in catch
- `messages/en.json` — Added `Health.schemaStale` message
- `messages/ro.json` — Added `Health.schemaStale` message (Romanian)
- `README.md` — Added deployment section with migrate-first instructions and schema-check SQL
- `dev_minions/architecture/data-model.md` — Added note on etf_report_links read-side fallback

### Modified test files (integration)
- `lib/health.test.ts` — Updated fixtures, added ST-1, HC-5, HC-6
- `lib/ai/chat.test.ts` — Added LE-C1 test for error path
- `lib/ai/boundaries.test.ts` — Added `lib/log/load-error` to allowed targets
- `app/health/page.test.tsx` — Updated fixtures, added HP-S3
- `app/health/page.failure.test.tsx` — Added HP-F4 test for sentinel error
- `app/page.test.tsx` — Added LE-P1 test for sentinel error
- `app/etf/[symbol]/page.test.tsx` — Added LE-P2, LE-P2n tests
- `app/admin/etfs/page.test.tsx` — Added LE-P6 test
- `app/admin/etfs/[symbol]/fields/page.test.tsx` — Added LE-P7, LE-P7n tests
- `app/admin/ai/page.test.tsx` — Added LE-P8 test
- `app/admin/cron/page.test.tsx` — Added LE-P9 test
- `app/admin/operations/page.test.tsx` — Added LE-P10 test

## Summary

**All 7 acceptance criteria are MET with comprehensive test coverage:**

- AC1: 10 tests (LE-1..10) — Core safe logging function
- AC2: 13 tests (LE-P1..10, LE-C1, HP-F4, HC-6) — Every page/catch site integrated
- AC3: 8 tests (HS-1..3, ST-1, HC-5, HP-S1..3) — Schema drift detection in /health
- AC4: 7 tests (HF-1..7) — Home table fallback for missing links table
- AC5: 6 tests (LB-E0..5) — No new secret exposure paths
- AC6: Bilingual messages verified, all gates passing
- AC7: 2 tests (RD-D1, RD-D2) + MANUAL-QA — README deployment instructions

**Total test counts (entire suite):**
- Test Files: 162 passed
- Tests: 1743 passed
- No failures specific to US-033

Denied or attempted commands: none
