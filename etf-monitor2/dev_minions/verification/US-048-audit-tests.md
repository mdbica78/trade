# US-048 — Sprint 9 audit C1 / AC5 independent test verdict

**Verdict: PASS**

## Scope

Independently verified the reopened Sprint 9 audit finding C1 and US-048 AC5 only. No full suite
was run, avoiding overlap with US-040 implementation. No build was run because generated Next types
were present (`.next/types`). No code, status, or HANDOVER files were changed.

## Evidence

All commands below ran after removing `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, and `GROQ_API_KEY` from the process environment. The `pnpm`
command was invoked by absolute path because bare `pnpm` was not on this shell's PATH.

1. `& 'C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd' exec vitest run lib/deploy/migrate.test.ts scripts/migrate-on-deploy.build.test.ts`
   - Exit code: **0**
   - Result: **2 test files passed; 23 tests passed**.
   - Includes the real-migrations guard check and synthetic destructive-statement cases.

2. `& 'C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd' exec vitest run lib/deploy/migrate.test.ts -t 'MD-G11'`
   - Exit code: **0**
   - Result: **1 passed; 21 skipped**.
   - MD-G11 supplies the exploit-shaped same-block SQL (`CREATE TABLE` followed by `DROP TABLE`)
     and confirms the current guard reports the `DROP` violation.

3. `& 'C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd' typecheck`
   - Exit code: **0** (`tsc --noEmit`).

Code inspection confirms `guardMigrationStatements` checks `DROP_RE` for every breakpoint-delimited
statement block and no longer skips a whole block beginning with `CREATE TABLE`; the new-table
column exception remains specific to the `ADD COLUMN ... NOT NULL` rule.

## Scope limits and command notes

- Full test suite and build: **not run** (per scope; generated Next types already present).
- No database connection, migration, deploy, or git command was run.
- Initial commands using bare `pnpm` could not start because it was not recognized on PATH; the
  same requested gates were then run successfully using the installed `pnpm.cmd` absolute path.
- Standalone `tsx -e` probes were abandoned after command-line quoting errors; MD-G11 was run
  directly under Vitest instead.
- Denied or attempted git/secret commands: **none**.
