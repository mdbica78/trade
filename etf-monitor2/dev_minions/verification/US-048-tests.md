# US-048 — Test verification (round 1)

Verdict: PASS

## Test results

Exit codes and summary lines:
- `pnpm install --frozen-lockfile`: exit 0 — "Lockfile is up to date"
- `pnpm typecheck`: exit 0
- `pnpm lint`: 0 errors, 9 pre-existing warnings
- `pnpm test`: 166 files / 1771 tests, exit 0
- `pnpm build`: exit 0 — "Compiled successfully in 23.5s" (output shows "migrate-on-deploy: skipped (not a production build)" confirming AC4)

## Acceptance criteria — test mapping

**AC1** — Never touches DB outside production; with stubs: VERCEL_ENV unset/preview/development/no DATABASE_URL → exit 0, no child, skip/warning line
- MET: `lib/deploy/migrate.test.ts:14` MD-1 (VERCEL_ENV unset → skip, no child)
- MET: `lib/deploy/migrate.test.ts:22` MD-2 (VERCEL_ENV=preview → skip, no child)
- MET: `lib/deploy/migrate.test.ts:29` MD-3 (VERCEL_ENV=development → skip, no child)
- MET: `lib/deploy/migrate.test.ts:36` MD-4 (production, no DATABASE_URL → warning, no child, exit 0)

**AC2** — Production + DATABASE_URL runs drizzle-kit migrate exactly once on success; retries up to 3 times on failure
- MET: `lib/deploy/migrate.test.ts:44` MD-5 (production+DB success → exactly 1 child run, drizzle-kit migrate command)
- MET: `lib/deploy/migrate.test.ts:52` MD-6 (failing child retries up to 3 times then exits non-zero; sleep called 2 times between attempts)
- MET: `lib/deploy/migrate.test.ts:61` MD-7 (succeeds on second attempt, sleeps between)

**AC3** — Safe output: no URL, no driver message, no secrets; SQLSTATE codes and migration filenames extracted
- MET: `lib/deploy/migrate.test.ts:74` MD-S1 (sentinel URL stripped, message stripped, code=42P01 and file=0001_etf_report_links.sql extracted)
- MET: `lib/deploy/migrate.test.ts:84` MD-S2 (invalid code/file dropped, returns empty string)
- MET: `lib/deploy/migrate.test.ts:89` MD-S3 (empty output returns empty string)

**AC4** — package.json build is exactly "tsx scripts/migrate-on-deploy.ts && next build --webpack"; pnpm build succeeds locally without DATABASE_URL
- MET: `scripts/migrate-on-deploy.build.test.ts:6` MDB-1 (pins exact build script string)
- MET: `pnpm build` exit 0, locally without VERCEL_ENV (confirmed "skipped" message in output)

**AC5** — Guard test passes on current migrations (0000, 0001); fails on synthetic destructive patterns; allow-destructive marker exempts
- MET: `lib/deploy/migrate.test.ts:95` MD-G1 (NOT NULL inside CREATE TABLE allowed)
- MET: `lib/deploy/migrate.test.ts:100` MD-G2 (DROP TABLE flagged)
- MET: `lib/deploy/migrate.test.ts:105` MD-G3 (DROP COLUMN flagged)
- MET: `lib/deploy/migrate.test.ts:110` MD-G4 (RENAME COLUMN flagged)
- MET: `lib/deploy/migrate.test.ts:115` MD-G5 (ALTER COLUMN ... TYPE flagged)
- MET: `lib/deploy/migrate.test.ts:120` MD-G6 (ADD COLUMN ... NOT NULL w/o DEFAULT flagged)
- MET: `lib/deploy/migrate.test.ts:125` MD-G7 (ADD COLUMN ... NOT NULL DEFAULT 0 not flagged, expand-only)
- MET: `lib/deploy/migrate.test.ts:130` MD-G8 (plain ADD COLUMN not flagged)
- MET: `lib/deploy/migrate.test.ts:135` MD-G9 (allow-destructive marker exempts entire file)
- MET: `lib/deploy/migrate.test.ts:142` MD-G10 (real drizzle/0000 and drizzle/0001 pass the guard)

**AC6** — Migrations prove themselves on PGlite: journal-order apply + schema match table by table
- MET: `test/helpers/pglite.migrations.test.ts:21` PM-1 (etf_report_links exists after migration)
- MET: `test/helpers/pglite.migrations.test.ts:26` PM-2 (ON DELETE CASCADE verified: deleting etf deletes etf_report_links)
- MET: `test/helpers/pglite.migrations.test.ts:43` PM-3 (all SQL files in drizzle/ listed in journal)
- MET: `test/helpers/pglite.migrations.test.ts:57` PM-4 (every table from lib/db/schema.ts exists after migration)

**AC7** — Docs and text: README Deployment states push-only flow (no separate migrate step); Health check section names the script; message files drop "pnpm db:migrate" reference
- MET: `test/readme-deployment.test.ts:24` RD-D1 (Deployment section names scripts/migrate-on-deploy.ts before push step, no manual migrate step)
- MET: `test/readme-deployment.test.ts:38` RD-D2 (Health check section names scripts/migrate-on-deploy.ts, not "pnpm db:migrate"; contains [load-error])
- MET: `messages/en.json` Health.schemaStale updated (verified: "the next production deploy applies pending migrations" — no "pnpm db:migrate")
- MET: `messages/ro.json` Health.schemaStale updated (verified: "următoarea publicare aplică automat migrațiile")
- MET: `app/health/page.test.tsx:77` HP-S3 (schema stale message renders correctly in RO and EN with missing table names)

**AC8** — All gates pass with DATABASE_URL, CRON_SECRET, VERCEL_ENV unset
- MET: typecheck exit 0 (no errors)
- MET: lint exit 0 (0 errors)
- MET: build exit 0 (output shows "migrate-on-deploy: skipped (not a production build)")
- MET: test exit 0 (166 files / 1771 tests)

## Summary

**All 8 acceptance criteria MET.** Every criterion is covered by at least one test with explicit file:line citation. All local gates pass (install, typecheck, lint, test, build).

No failures to report.

Denied or attempted commands: none
