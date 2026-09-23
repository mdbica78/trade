# US-003 — Database schema and Drizzle/Neon setup — Test verification

## Round 1 — 2026-09-23

Verdict: **PASS**

### Command exit codes

| Command | Exit code | Notes |
|---------|-----------|-------|
| `pnpm install` | 0 | Already up to date |
| `pnpm typecheck` | 0 | — |
| `pnpm lint` | 0 | — |
| `pnpm test` (with `env -u DATABASE_URL`) | 0 | 19 tests passed (3 files), no database required |
| `pnpm build` (with `env -u DATABASE_URL`) | 0 | Next.js 16.3.6 build successful |

### Acceptance criteria coverage

| AC | Criterion | Test name(s) | Verdict |
|---|---|---|---|
| AC1 | All seven tables exist with correct columns, types, nullability, defaults | `schema.test.ts` › "exports exactly the seven documented tables"; individual table tests: "etfs", "field_catalog", "tracked_fields", "reports", "report_values", "job_runs", "settings" | ✓ COVERED |
| AC1 (FKs) | Foreign keys `tracked_fields.etf_id → etfs.id`, `reports.etf_id → etfs.id`, `report_values.report_id → reports.id`, all `ON DELETE CASCADE`; `field_key` is NOT an FK; all FK columns NOT NULL (DEC-010 D1) | `schema.test.ts` › "declares exactly the three documented FKs, all ON DELETE CASCADE, all NOT NULL" | ✓ COVERED |
| AC2 | `UNIQUE (etf_id, report_date)` on `reports`; `UNIQUE (report_id, field_key)` on `report_values` | `schema.test.ts` › "reports has UNIQUE (etf_id, report_date)"; "report_values has UNIQUE (report_id, field_key)" | ✓ COVERED |
| AC3 | `pnpm db:generate` produces migration SQL on disk; SQL contains all tables, unique constraints, cascades, and check | `schema.test.ts` › "has a journal with at least one migration entry, and the SQL file exists"; "the generated SQL contains all seven CREATE TABLE statements, both unique guards, three cascades and the settings check" | ✓ COVERED |
| AC4 | DB client throws `MissingDatabaseUrlError` (named, with message mentioning `DATABASE_URL`) when URL is missing | `index.test.ts` › "throws MissingDatabaseUrlError when the URL is undefined, empty or blank" | ✓ COVERED |
| AC5 | `pnpm test` passes with no database reachable | All 19 tests pass with `env -u DATABASE_URL`; schema tests read files only; client test mocks Neon driver | ✓ COVERED |
| AC6 | `pnpm build` succeeds | Build completed successfully with `env -u DATABASE_URL` | ✓ COVERED |
| Notes | JSDoc comment on `reportDate` states "for, not published/fetched" | `lib/db/schema.ts` line 64–65: `/** Date the report is FOR, not published/fetched — see US-001 FINDINGS (footer date vs filing stamp). */` | ✓ COVERED |
| — (optional, deferred) | Migration applies cleanly on real Neon DB | `MANUAL-QA` (belongs to US-006 per plan, section 1) | — |

### Test files created

- `lib/db/schema.test.ts`: 14 tests covering all table definitions, columns, constraints, and migrations
- `lib/db/index.test.ts`: 4 tests covering client creation and error handling
- `lib/format.test.ts`: 1 test (pre-existing, unrelated to this story)

### Generated migration files verified

- `drizzle/0000_init.sql`: 2,678 bytes, created 2026-09-23 16:07
- `drizzle/meta/_journal.json`: 198 bytes (confirms 1 migration entry)
- `drizzle/meta/0000_snapshot.json`: 11,122 bytes

SQL content confirmed to include:
- All 7 `CREATE TABLE` statements
- `UNIQUE (etf_id, report_date)` on `reports`
- `UNIQUE (report_id, field_key)` on `report_values`
- 3 `ON DELETE CASCADE` foreign keys
- `CHECK "settings"."id" = 1` constraint

### Offline smoke check

`DATABASE_URL=postgresql://u:p@127.0.0.1:9/x pnpm db:migrate` correctly:
- Resolved the `@neondatabase/serverless` driver (confirmed in output: "Using '@neondatabase/serverless' driver")
- Failed with a connection error (WebSocket attempt failed), not a "driver not found" message
- This proves the migrate script will work in US-006 without agents touching Neon

### Drift check

`env -u DATABASE_URL pnpm db:generate` reported "No schema changes, nothing to migrate" — confirms no drift between `lib/db/schema.ts` and committed SQL, and that generate works offline.

### Summary

All six acceptance criteria (plus Notes and optional deferred) are covered by tests or manual verification. All command exit codes are 0. No test regressions. Schema, migrations, client error handling, and DEC-010 (NOT NULL FK columns) are all in place and tested offline.
