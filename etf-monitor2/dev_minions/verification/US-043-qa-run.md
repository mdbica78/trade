## QA run 1 — 2026-10-04 18:12
Verdict: BLOCKED
Machine checks: 6/7   Left for the user: 2

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (Windows pnpm.cmd; eight database/deploy/key variables removed, earlier this QA cycle) → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.1s`. |
| 2 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (same variables removed, earlier this QA cycle) → 0 → `$ tsc --noEmit`. |
| 3 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (same variables removed, earlier this QA cycle) → 0 → `9 problems (0 errors, 9 warnings)`. |
| 4 | Full suite (qa.md #1) | AUTO | PASS | `pnpm test` (same variables removed, earlier this QA cycle) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 5 | Offline production build (qa.md #1) | AUTO | PASS | `pnpm build` (same variables removed, earlier this QA cycle) → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes. |
| 6 | Generated migration and journal order (qa.md #3; AC1–AC2) | AUTO | PASS | Read `drizzle/0004_etf_widgets.sql` and `drizzle/meta/_journal.json`: journal idx 4 follows `0003_ai_provider_keys`; SQL creates only `etf_widgets` with closed constraints, unique ETF/slot and `ON DELETE cascade` FK to `etfs`. No live migration command was run. |
| 7 | Focused schema/PGlite/config/boundary checks (qa.md #2; AC1–AC6) | AUTO | BLOCKED | `pnpm exec vitest run lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/config/widgets.test.ts lib/config/widgets.pglite.test.ts lib/config/default-deps.widgets.test.ts lib/config/boundaries.test.ts` (eleven variables removed) → 1 → `4 passed | 2 failed (6)` files, `73 passed | 4 failed (77)` tests: PGlite package `pglite.data`/JS chunk missing mid-run (`ENOENT`, `MODULE_NOT_FOUND`). One retry of the same command → 1 before tests: `ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR ... directory is not empty`. No widget assertion failed. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm drafted AC1–AC7 and the six-per-ETF catalogue-only default.
- [LIVE-DB] After the ordinary push, check `/health` for a connected, current schema. Do not manually run the migration or inspect secret-bearing tables. US-043 has no widget UI.

### Failures (if any)
- No confirmed product defect. The focused PGlite run is blocked by an unstable shared `node_modules` directory. Rerun it with a stable install/workspace; do not weaken the tests or apply migrations to Neon.

No app/tests changed, no git/secret/credential file or live database/provider/Vercel resource accessed.

## QA run 2 — 2026-10-04 18:22
Verdict: PASS
Machine checks: 7/7   Left for the user: 2

The prior run's missing-package blocker cleared with the working WSL toolchain. The frozen install, typecheck, lint, full suite, offline build and migration/journal inspection from QA run 1 above remain passing evidence produced earlier in this same QA cycle; no source/test change to US-043 intervened. No migration was run against a real database.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Focused schema, migration, config, validator and boundary suite (qa.md #2; AC1–AC7) | AUTO | PASS | `bash -lc 'pnpm exec vitest run lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/config/widgets.test.ts lib/config/widgets.pglite.test.ts lib/config/default-deps.widgets.test.ts lib/config/boundaries.test.ts'` (eleven DB/deploy/key variables removed) → 0 → `Test Files 6 passed (6); Tests 84 passed (84)`. W-PM-1 verified migration order and closed constraints; all four widget config PGlite tests passed, including rollback. |
| 2 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (earlier this cycle) → 0 → `Lockfile is up to date`. |
| 3 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (earlier this cycle) → 0 → `tsc --noEmit`. |
| 4 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (earlier this cycle) → 0 → `0 errors, 9 warnings`. |
| 5 | Full suite (qa.md #1) | AUTO | PASS | `pnpm test` (earlier this cycle) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 6 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` (earlier this cycle) → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes. |
| 7 | Generated migration (qa.md #3) | AUTO | PASS | Direct inspection earlier this cycle: `0004_etf_widgets.sql` creates only the new table and cascade FK; journal entry idx 4 follows `0003_ai_provider_keys`. W-PM-1 now passed against PGlite. |

### For the user
- [JUDGMENT] Confirm drafted AC1–AC7 and catalogue-only six-slot behavior.
- [LIVE-DB] After normal push, check `/health` for a connected, current schema; no manual Neon migration or secret-table read.

### Failures
- None in round 2. Round 1's package-instability evidence is retained above.

No git, real secret, credential file, live DB, migration, provider or deploy operation was performed.
