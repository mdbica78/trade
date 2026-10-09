# US-048 QA checklist — Migrations applied by the production deploy

Round 1: review PASS (`US-048-review.md`, no Critical, 2 non-blocking notes — AC6's PGlite test
proves table existence after migration, not column-level parity, acceptable against the AC's
literal wording; `spawnDrizzleMigrate`'s real child-process shell-out has no unit test, by design —
AC1/AC2 are proven through the injected `RunChild` seam instead). Tests PASS (`US-048-tests.md`,
all 8 acceptance criteria MET with file:line evidence, 166 test files / 1771 tests, typecheck/lint/
build all green with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`GEMINI_API_KEY`/`GROQ_API_KEY`
unset).

All acceptance criteria were DRAFTED BY AGENT (Technical Lead chat, in `backlog/stories/US-048.md`)
— PO to confirm at the next demo.

## Automated (already run, not manual)
1. `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm
   typecheck && pnpm lint && pnpm test && pnpm build` — PASS (0 typecheck errors; 0 lint errors, 9
   pre-existing warnings; 166 files / 1771 tests, exit 0; build offline, prints
   `migrate-on-deploy: skipped (not a production build)` then completes all 12 routes).
2. `lib/deploy/migrate.test.ts` (MD-1..MD-7, MD-S1..MD-S3, MD-G1..MD-G10) and
   `scripts/migrate-on-deploy.build.test.ts` (MDB-1) cover AC1-AC5 with no real database or child
   process (spawn/sleep injected throughout).
3. `test/helpers/pglite.migrations.test.ts` PM-4 confirms every `schemaTableNames(schema)` table
   exists in a fresh PGlite database after applying `drizzle/*.sql` in journal order (AC6).
4. `test/readme-deployment.test.ts` RD-D1/RD-D2 confirm README's "Deployment" section names the
   script before the push step with no separate manual migrate step, and the "Health check"
   section has no `pnpm db:migrate` wording (AC7).

## Manual checks (for the Codex QA loop / the user)
1. **After your next push**, check the Vercel production build log: it should show exactly one of
   `migrate-on-deploy: skipped (not a production build)` (should not appear on Production),
   `migrate-on-deploy: WARNING — production build with no DATABASE_URL, skipping migrations`, or
   `migrate-on-deploy: migrations applied` — never a raw connection string or driver message.
2. **After the deploy**, check `/health`: the schema-drift line should disappear (the
   `etf_report_links` table now exists), and the home page should load instead of "Could not load
   the data."
3. No live Neon/Vercel step is required to reach this state — the production build itself applies
   the migration (DEC-023). Nothing for you to run manually beyond the normal `git push`.
4. PO to confirm: AC1-AC8 above were drafted by the agent from `backlog/stories/US-048.md`
   (itself already reviewed by the Technical Lead chat and the in-loop tech-lead's Sprint 9
   review) — flag any wording you'd change.

## Files changed (US-048, final)
- new: `lib/deploy/migrate.ts`, `lib/deploy/migrate.test.ts`, `scripts/migrate-on-deploy.ts`,
  `scripts/migrate-on-deploy.build.test.ts`
- changed: `package.json` (`"build": "tsx scripts/migrate-on-deploy.ts && next build --webpack"`),
  `README.md` (Deployment + Health check sections), `messages/en.json`, `messages/ro.json`
  (`Health.schemaStale` drops `pnpm db:migrate`), `test/readme-deployment.test.ts` (RD-D1/RD-D2),
  `test/helpers/pglite.migrations.test.ts` (+PM-4)
- `dev_minions/verification/US-048-plan.md` (planned inline), `US-048-review.md`, `US-048-tests.md`,
  `US-048-qa.md` (this file, new)
