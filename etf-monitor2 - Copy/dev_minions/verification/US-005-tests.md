# US-005 Tests — Seed ETF registry and field catalogue

## Round 1 — 2026-09-23

Verdict: PASS

### Test execution summary

| Command | Exit code | Result |
|---------|-----------|--------|
| pnpm install | 0 | Pass |
| pnpm typecheck | 0 | Pass |
| pnpm lint | 0 | Pass |
| pnpm test | 0 | Pass (50 tests, 11 files) |
| pnpm build | 0 | Pass |

### Acceptance criteria mapping

| AC | Requirement | Test coverage | Status |
|----|-------------|----------------|--------|
| AC1 | Seed exactly 3 ETFs, 8 field-catalogue rows, 2 tracked-field rows, 1 settings row | `lib/db/seed-data.test.ts`: "seeds exactly the expected counts" (line 24-28) | MANUAL-QA (needs live Neon) |
| AC2 | Idempotent seeding (safe to run multiple times) | Code review: `lib/db/seed.ts` uses `onConflictDoUpdate/onConflictDoNothing` pattern on all tables (idempotent by construction); MANUAL-QA for live verification | MANUAL-QA (needs live Neon) |
| AC3 | Reads DATABASE_URL from env; nothing hardcoded | Code review: `seed.ts` imports `getDb()` (already throws `MissingDatabaseUrlError` if unset per US-003); lint/typecheck clean | COVERED (lint + typecheck + code review) |
| AC4 | Seed data passes consistency checks | `lib/db/seed-data.test.ts` (5 tests all passed): "every tracked field key exists in the field catalogue" (line 10-15), "every ETF's adapter key is present in the field catalogue" (line 17-22), "seeds exactly the expected counts" (line 24-28), "has no duplicate ETF symbols or field catalog keys" (line 30-35), "settings row uses id 1 and a valid default locale" (line 37-40) | COVERED (5/5 tests pass) |
| AC5 | pnpm test, lint, build stay green with no DATABASE_URL set | All three commands passed exit code 0 in this run (no DATABASE_URL exported) | COVERED (all commands pass) |

### Test file results

- **lib/db/seed-data.test.ts**: 5 tests passed
  - every tracked field key exists in the field catalogue ✓
  - every ETF's adapter key is present in the field catalogue ✓
  - seeds exactly the expected counts ✓
  - has no duplicate ETF symbols or field catalog keys ✓
  - settings row uses id 1 and a valid default locale ✓

- **All other test files** (i18n, components, lib/format, db/index, db/schema): 45 tests passed (no failures or regressions)

### Files verified

- `lib/db/seed-data.ts` — seed data arrays, exports seedEtfs, seedFieldCatalog, seedTrackedFields, seedSettings
- `lib/db/seed.ts` — async seed(db: Db) function using upsert pattern (idempotent)
- `scripts/db-seed.ts` — CLI entry point for `pnpm db:seed` command
- `package.json` — `db:seed` script added (line 14), `tsx` devDependency present (line 33)
- `lib/db/seed-data.test.ts` — comprehensive data consistency tests (5 tests)

### Notes

- No failures or flakes detected in this round.
- AC1 and AC2 are marked MANUAL-QA per the plan (require live Neon database). The seed data unit tests validate the data structure; live idempotency verification is deferred to QA.
- Build succeeds with no DATABASE_URL set, confirming the CLI is not imported by app code (AC5).
- The timeZone warnings in test stderr (from next-intl) are configuration notices, not test failures; all 50 tests passed successfully.
