# US-048 — plan (planned inline, simple story per sprint-09.md)

Criteria → tests:
- AC1/AC2 → `scripts/migrate-on-deploy.test.ts`: fake `child_process.spawn`/`execFile` (injected), fake env, fake clock/sleep. Cases: unset/preview/development env → skip, no child; production no `DATABASE_URL` → warn, no child; production+DB success → exactly 1 child run; production+DB failing child → retries 3x then exits non-zero.
- AC3 → `scripts/migrate-on-deploy.test.ts` (`sanitizeMigrationOutput` pure fn, separately unit-tested): strips URLs/messages, keeps only `code=XXXXX`/`file=000N_name.sql` tokens matching the regexes; invalid tokens dropped.
- AC4 → `scripts/migrate-on-deploy.build.test.ts`: pins `package.json`'s `build` script string; `pnpm build` itself is exercised by AC8's local gates.
- AC5 → `scripts/migrate-on-deploy.guard.test.ts`: guard fn scans `drizzle/*.sql` for `DROP`, `RENAME`, `ALTER COLUMN ... TYPE`, `ADD COLUMN ... NOT NULL` w/o `DEFAULT` (skip matches inside `CREATE TABLE` per tech-lead note); passes on 0000/0001; synthetic fixture strings for each forbidden pattern; `-- allow-destructive: DEC-XXX` marker exempts.
- AC6 → extend `test/helpers/pglite.migrations.test.ts` only if needed; current PM-1..3 already prove journal-order apply + schema match indirectly — add one assertion comparing PGlite's `information_schema` columns against `lib/db/schema.ts` table list if not already covered.
- AC7 → `test/readme-deployment.test.ts` (extend): README "Deployment" grep for push-only wording, no `pnpm db:migrate` in the flow step; `lib/health.test.ts`: schema line no longer says `pnpm db:migrate`.
- AC8 → local gates.

Files: new `scripts/migrate-on-deploy.ts`, `scripts/migrate-on-deploy.test.ts` (+ guard/build test files, or one file — implementer's call); changed `package.json` (`build` script), `README.md` (Deployment section), `lib/health.ts` + `lib/health.test.ts` (schema line wording), `messages/en.json`/`messages/ro.json` (`Health.schema*` string, drop `pnpm db:migrate`), `test/readme-deployment.test.ts`.

No DB access in tests — spawn is injected/mocked throughout.
