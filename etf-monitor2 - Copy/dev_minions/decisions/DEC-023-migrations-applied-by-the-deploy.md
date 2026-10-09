# DEC-023 — Database migrations are applied by the production deploy

Status: **Decided** (Technical Lead chat, 2026-09-28), on the user's rule: "no pnpm or manual step; everything is fixed by git push; the code keeps going without me."
Supersedes: the "migrate, then deploy by hand" order in US-033 AC7 / README "Deployment", and the "Neon migration is a live step for the user" line in AGENTS.md and the sprint files.
Unchanged: an agent never runs anything against Neon or Vercel; it only writes migration files.

## Context
Every new table so far needed the user to run `pnpm db:migrate` against Neon. That is exactly what went wrong in production: `drizzle/0001_etf_report_links.sql` was never applied, so the live home page shows "Could not load the data." Sprints 9-11 add four more migrations. A user step that is easy to forget is a defect in the process, not a task for the user.

## Decision
1. **The production build applies pending migrations, then builds.** `package.json` `build` becomes `tsx scripts/migrate-on-deploy.ts && next build --webpack`. The script runs the same `drizzle-kit migrate` that `pnpm db:migrate` runs today (proven on this project; no new migrator, no new dependency). Vercel runs `pnpm run build` on every push, so a `git push` to the production branch is the whole procedure.
2. **Only production, only with a database.** The script acts only when `VERCEL_ENV === "production"` and `DATABASE_URL` is set. Preview deployments, local builds, `predeploy-check.sh`, CI and the tests never touch Neon; they print one line "migrations skipped (reason)". With `DATABASE_URL` unset in production the build still succeeds and prints a visible warning; `/health` then reports the schema as behind (US-033).
3. **A failed migration fails the build.** Non-zero exit, sanitised message (the closed SQLSTATE code and the migration file name only, never the connection string or driver text). Vercel then keeps serving the previous deployment, which tolerates a missing table (DEC-019). Up to 3 attempts with a short pause absorb a Neon cold start.
4. **Migrations must be expand-only**, because the database changes a moment before the new code goes live and the old code runs against the new schema in between: new tables, new nullable columns or columns with defaults, new indexes. No drop, rename, type change or `NOT NULL` without default in one step. A destructive change is a two-deploy sequence (stop using, then remove) and needs its own decision. A test scans `drizzle/*.sql` for `DROP`, `RENAME` and `ALTER COLUMN ... TYPE` and fails unless the file carries an explicit `-- allow-destructive: DEC-XXX` marker.
5. **Agents generate, the deploy applies.** An agent may run `pnpm db:generate` and commit the SQL and snapshot files (the user commits, as always); it must not run `db:migrate`, `drizzle-kit migrate` or the script against a real database. Tests apply the same migration files to PGlite, which is how each migration is proven.
6. **Known limits, stated.** (a) The first deploy after this change applies every pending migration, including `0001_etf_report_links`, which should repair the live home page; if Neon's migration journal was never created, the first run fails loudly (case 3) instead of guessing. (b) Two simultaneous production deploys could race; not guarded (rare, and the journal makes a retry safe). (c) `DATABASE_URL` must be enabled for Production for the build step as well as runtime (Vercel does this by default for the selected environments).

## Consequences
- US-048 implements this first in Sprint 9 (before US-047, the first new migration). It also updates `README.md` Deployment, the `/health` schema message (no `pnpm db:migrate` wording: "the next production deploy applies it"), `scripts/claude/predeploy-check.sh` (unchanged behaviour, skips migration) and AGENTS.md line about Neon.
- Every sprint file's "live steps" for migrations disappear; the only user action left in the project is committing and pushing (git stays with the user).
- QA (Codex) cannot see a Vercel build; its checklist for migration stories proves them on PGlite and lists "after push, `/health` shows no schema line" as an observation, not a step.
