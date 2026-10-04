# US-043 — Round 1 Independent Test Verification

**Status: PASS**  
**Test date:** 2026-10-03  
**Phase:** Independent test round 1

## Environment and safety

- Ran the focused suite, project typecheck, lint, full test suite and offline
  build from the project directory.
- Removed `DATABASE_URL`, `CRON_SECRET`, `AI_KEY_MASTER_KEY`, `VERCEL_ENV`,
  `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`,
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY` from the process
  environment before command execution; no variable value was read or printed.
- Migration integration used the repository's PGlite test helper. No live
  database, migration, provider, Vercel, or BVB resource was used. No
  `ai_provider_keys` row was accessed.
- No source, test, status, HANDOVER, or other verdict file was edited.

## Acceptance criteria

| Criterion | Result | Evidence produced in this round |
|---|---|---|
| **AC1 — persisted closed schema** | **MET** | `lib/db/schema.test.ts` passed (24 tests), including the `etf_widgets` column/check/FK/unique-constraint assertions. `test/helpers/pglite.migrations.test.ts` W-PM-1 applied the journal to PGlite, accepted valid boundary rows, rejected duplicate slot, invalid slot/operation/unit/amount, fractional amount and invalid ETF FK, and verified cascade. |
| **AC2 — expand-only migration path** | **MET** | Inspected `drizzle/0004_etf_widgets.sql`: it creates the new table and adds its cascade FK only. `drizzle/meta/_journal.json` registers it as entry 4 after `0003_ai_provider_keys`. PGlite migration test W-PM-1 passed in the focused suite. No live migration command/resource was used. |
| **AC3 — one closed validation gate** | **MET** | `lib/config/widgets.test.ts` passed (26 tests): covers all operations and period units, amount/title boundaries, unknown/non-numeric fields, malformed and non-definition-shaped inputs, extra keys, and formula/code/URL-shaped values with closed errors. `lib/config/widgets.pglite.test.ts` passed (4 tests), covering public-operation `unknown_etf`, `bad_slot`, `too_many`, and rejection without table writes. |
| **AC4 — add and update operations** | **MET** | `lib/config/widgets.pglite.test.ts` verifies first-free slot order, all six occupied slots and no overwrite on `too_many`, slot reuse after clear, bad slot/field handling, and partial update preserving the unchanged definition fields. |
| **AC5 — clear and replace operations** | **MET** | `lib/config/widgets.pglite.test.ts` verifies clear-one/clear-all isolation between ETFs, replacement input order, empty replacement, invalid/over-capacity replacement preserving prior rows, and a forced batch failure rolling back to the original list. |
| **AC6 — configuration boundary** | **MET** | `lib/config/boundaries.test.ts` passed (21 tests), including BC-11 scanning `app/` and `lib/ai/` for widget write SQL. PGlite tests exercise the public config API. The current code contains no action/chat implementation or SQL caller to exercise yet; US-045 owns those future callers. The validator catalogue is based on the adapter field-key/catalogue intersection and the tests reject raw/non-catalogue fields. |
| **AC7 — defaults and build gates** | **MET** | The six-slot constant, database range check, and PGlite per-ETF isolation/capacity tests passed. Independently ran all gates below: focused suite 6 files/83 tests; typecheck exit 0; lint exit 0 with 0 errors/9 warnings; full suite 207 files/2114 tests exit 0; offline build exit 0 with migration runner skipped and all 12 dynamic routes generated. |

## Commands and results

1. **Focused schema, migration, validator, config and boundary suite**

   ```text
   pnpm exec vitest run lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/config/widgets.test.ts lib/config/widgets.pglite.test.ts lib/config/default-deps.widgets.test.ts lib/config/boundaries.test.ts
   ```

   Bare `pnpm` was not on the shell `PATH`; reran using
   `C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd`. Exit code **0** —
   **6 files / 83 tests passed**.

2. **Typecheck**

   `pnpm typecheck` → `tsc --noEmit`; exit code **0**.

3. **Lint**

   `pnpm lint`; exit code **0**, **0 errors / 9 warnings**.

4. **Full test suite**

   `pnpm test`; exit code **0**, **207 files / 2114 tests passed**.

5. **Offline production build**

   `pnpm build`; exit code **0**. The migration runner reported
   `migrate-on-deploy: skipped (not a production build)`; Next.js generated
   all **12 dynamic routes**.

All commands were invoked with the relevant database/deployment/key variables
removed from the process environment; their values were not inspected.

**Denied or attempted commands:** initial bare `pnpm exec vitest run ...`
attempted but could not start because `pnpm` was not recognized on `PATH`.
It was not retried in the same form; the focused suite ran successfully
through the installed explicit `pnpm.cmd` path. No git, secret/credential
file, live-resource, or migration command was attempted.
