# US-003 QA — Database schema and Drizzle/Neon setup

**Story**: Database schema and Drizzle/Neon setup  
**Round 1 review**: PASS (story-reviewer subagent, independent context)  
**Round 1 tests**: PASS (story-tester subagent, 19/19 tests with env -u DATABASE_URL)  
**Verdict**: All acceptance criteria met, ready for user acceptance

---

## Acceptance criteria verification

All six acceptance criteria (AC1–AC6) plus the verification note have been independently tested and passed.

| AC | What was tested | Proof | Status |
|---|---|---|---|
| AC1: Seven tables with exact column structure | Schema introspection (columns, types, nullability, defaults) vs data-model.md | `lib/db/schema.test.ts` "tables and columns" (8 tests) + "foreign keys" (5 tests) | ✓ PASS |
| AC1: Three FKs with ON DELETE CASCADE | FK references and cascade behavior; NOT NULL on all three (per DEC-010) | `schema.test.ts:168-219` "foreign keys"; `drizzle/0000_init.sql` checked | ✓ PASS |
| AC2: UNIQUE guards for duplicate ingestion | `UNIQUE (etf_id, report_date)` on reports; `UNIQUE (report_id, field_key)` on report_values | `schema.test.ts:222-234` "duplicate-ingestion guards"; SQL verified | ✓ PASS |
| AC3: Migration SQL generated and committed | `pnpm db:generate` produces drizzle/ folder with SQL and metadata, no drift | `schema.test.ts:236-272` "committed migration"; re-run showed "No schema changes" | ✓ PASS |
| AC4: MissingDatabaseUrlError on missing DATABASE_URL | Client throws named error when variable missing; singleton lazy load | `lib/db/index.test.ts` (4 tests + 1 singleton) all pass; driver mocked | ✓ PASS |
| AC5: Tests pass offline with no DATABASE_URL | All 19 tests run without DB reachable | Story-tester: `env -u DATABASE_URL pnpm test` → 3 files, 19/19 PASS | ✓ PASS |
| AC6: Build succeeds without DATABASE_URL | `pnpm build` clean; no `lib/db` imports in app yet | Story-tester: `env -u DATABASE_URL pnpm build` → success; `pnpm typecheck`, `pnpm lint` clean | ✓ PASS |
| Verification note: `report_date` documented | JSDoc comment on `reportDate` column states "for, not published/fetched" | `lib/db/schema.ts:64` contains the comment | ✓ MET |

---

## What the user needs to do

### 1. Verify locally (optional—independent agents already confirmed)

```bash
cd /mnt/c/_mystaff/myG/trade/etf-monitor2

# Check the schema matches and is ready
env -u DATABASE_URL pnpm db:generate
# Expected: "No schema changes, nothing to migrate"; no new files under drizzle/

# Run full check suite
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
# Expected: all green, 19+ tests pass, build succeeds
```

### 2. Commit the files (git is the user's responsibility)

These files must be committed:

**New files:**
- `drizzle.config.ts`
- `lib/db/schema.ts` (7 tables)
- `lib/db/index.ts` (MissingDatabaseUrlError + lazy client)
- `lib/db/schema.test.ts` (14 tests)
- `lib/db/index.test.ts` (5 tests)
- `drizzle/0000_init.sql` (migration SQL — **critical, must commit**)
- `drizzle/meta/_journal.json` (drizzle metadata — **must commit**)
- `drizzle/meta/0000_snapshot.json` (drizzle snapshot — **must commit**)
- `dev_minions/decisions/DEC-010-us003-schema-and-driver.md` (Decided)

**Modified files:**
- `package.json` (drizzle-orm, @neondatabase/serverless, drizzle-kit added)
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.env.example` (DATABASE_URL documented)
- `dev_minions/architecture/data-model.md` (FK columns updated to NOT NULL per DEC-010)

**Deleted files:**
- `lib/db/.gitkeep` (folder no longer empty)
- `messages/.gitkeep` (folder no longer empty, from US-004)

### 3. MANUAL-QA step — deferred to US-006

Applying the migration to a live Neon database is explicitly out of scope for this story and deferred to US-006 (when Neon project is created and DATABASE_URL is available). Expected check when done:

```bash
export DATABASE_URL=<your Neon connection string>
pnpm db:migrate

# In Neon SQL editor:
select table_name from information_schema.tables where table_schema='public';
# Should list: etfs, field_catalog, tracked_fields, reports, report_values, job_runs, settings, drizzle_migrations

# Verify the CHECK constraint:
insert into settings(id) values (2);  -- Should fail: only id=1 allowed
```

---

## Technical decisions (resolved in DEC-010)

- **D1 — FK column nullability**: Implemented as `NOT NULL` on all three FK columns (`tracked_fields.etf_id`, `reports.etf_id`, `report_values.report_id`). Rationale: preserves the intent of the `UNIQUE (etf_id, report_date)` guard (NULLs are distinct in SQL UNIQUE) and the CASCADE delete semantics (child cannot outlive parent). `data-model.md` rows 3–5 updated to reflect.

- **D2 — Neon driver mode**: Implemented with HTTP mode (`drizzle-orm/neon-http` + `neon()`). Rationale: stateless, lowest latency for Vercel functions, no `ws` dependency, atomic write via `db.batch([...])`. The driver is isolated in `lib/db/index.ts`, changeable in one file if Sprint 3 ingestion later needs interactive transactions.

- **Binding note for Sprint 3 (US-012)**: Because HTTP driver has no interactive transactions, the ingestion write must be atomic (batch or upsert-then-values in one call, or switch drivers under a new DEC). Nothing to action now.

---

## Notes

- One optional offline smoke check (drizzle-kit migrate driver resolution against a literal `127.0.0.1` URL) from the plan was denied by the sandbox during implementation but succeeded when story-tester ran it independently. Not required for AC verification; confirms the driver is correctly installed.
- Schema tests introspect the runtime Drizzle model, not the SQL; this is intentional (matches ADR-001 approach). The committed migration SQL is tested separately for correctness.
- No `server-only` import added to `lib/db/index.ts` (would break Vitest without react-server condition and is premature until a client component imports the DB).

---

## Ready for acceptance

✓ All six ACs verified independently (PASS)  
✓ All 19 tests pass (PASS)  
✓ No regressions (typecheck, lint, build all clean)  
✓ No critical findings; no fix loop needed  

**Next step**: User commits the files listed above and marks US-003 Done in the demo file. US-005 and US-006 become eligible (their dependencies satisfied by US-003 Awaiting QA → Done).
