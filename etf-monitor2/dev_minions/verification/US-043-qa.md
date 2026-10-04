# US-043 QA checklist — widget definition and configuration

Development round 1: independent review PASS (`US-043-review.md`) and
independent tests PASS (`US-043-tests.md`), AC1–AC7 MET. The reviewer noted one
non-blocking LOW test-coverage gap: BC-11 scans action/chat widget writes but
does not guard direct reads; no caller currently contains direct widget SQL.

## Codex offline checks

1. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, and `pnpm build` with database/deployment/key variables
   removed from the process without printing their values. Expect exit 0,
   no live provider/Neon/Vercel access, and a skipped non-production
   migration. Do not run `db:migrate` or the deploy script against Neon.
2. Run `pnpm exec vitest run lib/db/schema.test.ts
   test/helpers/pglite.migrations.test.ts lib/config/widgets.test.ts
   lib/config/widgets.pglite.test.ts
   lib/config/default-deps.widgets.test.ts
   lib/config/boundaries.test.ts`. Expect closed schema checks, migration
   order, PGlite rollback, validation errors, per-ETF isolation and six-slot
   capacity to pass.
3. Inspect the generated `drizzle/0004_etf_widgets.sql` and journal:
   only the new table and its cascading FK are added, after 0003. The
   build applies it on a production deploy; never run it manually against
   a real database as part of this story.

## Post-push MANUAL-QA

4. After the user's ordinary push/deploy, check `/health` for a connected,
   current schema. There is no widget UI in US-043: US-044 renders the
   persisted definitions, and US-045 adds chat configuration. Do not
   inspect secret-bearing tables or enter a real key in tests.

PO to confirm drafted AC1–AC7 (FR18 / DEC-022); PW-1..PW-3 are isolated
defaults and do not block development. Codex QA is separate and may lag.

## Files changed

- `dev_minions/verification/US-043-plan.md`,
  `dev_minions/verification/US-043-review.md`,
  `dev_minions/verification/US-043-tests.md`,
  `dev_minions/verification/US-043-qa.md`,
  `dev_minions/HANDOVER.md`, `dev_minions/status.md`
- `lib/db/schema.ts`, `lib/db/schema.test.ts`,
  `drizzle/0004_etf_widgets.sql`, `drizzle/meta/0004_snapshot.json`,
  `drizzle/meta/_journal.json`,
  `test/helpers/pglite.migrations.test.ts`
- `lib/config/widgets.ts`, `lib/config/widgets.test.ts`,
  `lib/config/widgets.pglite.test.ts`, `lib/config/default-deps.ts`,
  `lib/config/default-deps.widgets.test.ts`,
  `lib/config/boundaries.test.ts`,
  `dev_minions/architecture/data-model.md`

No runtime dependency, lockfile, chat, UI or provider endpoint change.
