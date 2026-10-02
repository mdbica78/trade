# US-043 plan — Schema, validator and config functions for the widget definition

**Scope:** planning only. Implement the reviewed Sprint 11 story before US-044. The acceptance
criteria remain drafted for PO confirmation. This plan changes no source code, tests, status board,
or handover state.

## Binding inputs and decisions

- FR18 and the drafted criteria in `backlog/stories/US-043.md`.
- The reviewed sequence and binding constraints in `backlog/sprints/sprint-11.md` and
  `verification/SPRINT-11-review.md`: catalogue-only numeric fields, one config validation/write
  boundary, atomic replacement, PGlite-only migration verification, and no raw-field work.
- DEC-022 §§1, 3–5 and its isolated product defaults PW-1..PW-3: five operations, two period
  units, amount 1–365, optional plain-text title up to 60 characters, six per-ETF slots, column
  storage, closed errors, and `Db` + `BatchRunner` config functions.
- DEC-016 for the config-module boundary and atomic batch pattern; DEC-023 for locally generated,
  expand-only migrations applied by production builds only; DEC-010 for transaction-backed
  `BatchRunner`.
- Existing prior art: `lib/db/schema.ts`, `lib/db/schema.test.ts`, `drizzle/0000`–`0003` and
  `drizzle/meta/_journal.json`, `test/helpers/pglite.ts`,
  `test/helpers/pglite.migrations.test.ts`, `lib/config/tracked-fields.ts`,
  `lib/config/home-display.ts`, `lib/config/ai-settings.ts`, `lib/config/default-deps.ts`, and
  `lib/config/boundaries.test.ts`.

**Decisions needed: none.** PW-1..PW-3 ship as isolated defaults; they do not gate this story.
The approved review settles the technical contract. The adapter's `fieldKeys` are the existing
numeric extraction catalogue (each extracted value has a canonical `numericValue`); validation
will use the ETF's adapter/catalogue intersection, following `availableFieldKeys` in
`lib/config/tracked-fields.ts`. A replacement definitions array is stored in its listed order in
slots 1 through N. No additional product or technical decision is required.

## Boundaries and result contract

1. `lib/config/widgets.ts` is the only widget validation and configuration SQL module. It has no
   Next.js, UI, AI-provider, concrete database, `process.env`, network, extraction, or migration
   wiring. Its dependencies follow the existing `Db` + `BatchRunner` pattern, with the adapter
   registry supplied as a dependency.
2. Resolve the requested ETF within the config API and construct the numeric catalogue by
   intersecting that ETF's `adapter_key`, its `field_catalog` rows, and the registered adapter's
   `fieldKeys`. An absent ETF returns `unknown_etf`; missing/unregistered adapter or unlisted field
   returns `unknown_field`. Never infer fields from reports, `report_values`, labels, or `unit`;
   never add extraction fields.
3. `validateWidgetDefinition(input, catalogue)` is the single pure gate for definition-shaped,
   untrusted inputs. Require a plain object with only the five definition keys; reject unknown
   keys rather than ignoring them. Validate operation, `fieldKey`, period unit/amount, and optional
   title; preserve a supplied title as plain text and reject it only when it is not a string or
   exceeds 60 characters. Do not execute, interpret, or compile any input text. Return the
   applicable closed definition errors (`unknown_operation`, `unknown_field`, `bad_period`,
   `bad_title`) without throwing. The public config operations additionally return the closed
   `bad_slot`, `unknown_etf`, and `too_many` codes for their ETF/slot/capacity inputs.
4. Export the validator and typed per-ETF config operations: `listWidgetsForEtf`, `addWidget`,
   `updateWidget`, `clearWidget` (one slot or all), and `replaceWidgets`. Use ETF symbol as the
   external scope identifier, matching current config APIs; return stored slot and definition
   fields from reads and successful writes. Add uses the lowest free slot and never overwrites;
   update validates a merged definition but writes only supplied changes, retaining the other
   stored values. A missing slot returns `bad_slot`. Clear-all is scoped to the requested ETF.
   Replace validates the ETF and every definition, rejects lists over six with `too_many`, then
   deletes/inserts only that ETF's definitions in one atomic runner call. Empty replacement clears
   that ETF. Invalid inputs perform no writes; batch/DB failures propagate rather than becoming a
   success-shaped result.
5. Use an injected `now` dependency for `updated_at` on inserts and updates. Store optional title
   as nullable text. Use no JSON column or serialized-definition storage.
6. The migration is a separate generated `0004_etf_widgets` entry after `0003_ai_provider_keys`.
   Run `pnpm db:generate` locally only; review the SQL and snapshot for expand-only table creation.
   Never run `pnpm db:migrate`, `drizzle-kit migrate`, or the deploy migration script against Neon.
   The migration test helper already applies journaled SQL to PGlite in order.
7. Tests never select, seed, or inspect `ai_provider_keys`; never read secrets, environment
   variable values, `.env*`, or credential files. Use only literal harmless test data. No live
   Neon, Vercel, provider, BVB request, or deployment.

## Phase order

### Phase 1 — Schema and migration

1. Add `etfWidgets` to `lib/db/schema.ts` with exactly these columns: serial `id` primary key;
   non-null integer `etf_id` referencing `etfs.id` with `ON DELETE CASCADE`; non-null smallint
   `slot`; non-null text `operation`; non-null text `field_key`; non-null text `period_unit`;
   non-null integer `period_amount`; nullable text `title`; non-null timezone-aware `updated_at`.
   Add unique `(etf_id, slot)` and checks for operation in `change`, `percent_change`, `average`,
   `min`, `max`; period unit in `days`, `reports`; slot 1–6; and amount 1–365. Do not add a JSON
   definition column or a field-catalog FK.
2. Extend `lib/db/schema.test.ts` to register the thirteenth exported table and assert the exact
   column names, SQL types, nullability/default shape, FK target/cascade, unique pair, and Drizzle
   check metadata. Update any exact schema export/table-count expectations affected by the new
   table.
3. Generate migration and snapshot using `pnpm db:generate`, with no database URL supplied. Keep
   the stable generated tag `0004_etf_widgets`; do not hand-author a replacement snapshot. Inspect
   only the generated migration/schema metadata and confirm it creates the one new table with the
   intended constraints, adds the journal entry at index 4, and contains no destructive SQL.
   Expected generated files: `drizzle/0004_etf_widgets.sql`,
   `drizzle/meta/0004_snapshot.json`, and `drizzle/meta/_journal.json`.
4. Extend `test/helpers/pglite.migrations.test.ts`: prove the new migration is journaled after
   `0003_ai_provider_keys`, the migration helper creates the schema-declared table in journal
   order, a valid widget row is accepted, and deletion of its ETF cascades to that row. The test
   must not query or seed the provider-key table.
5. Extend `dev_minions/architecture/data-model.md` with the `etf_widgets` table columns,
   constraints, per-ETF six-slot ownership and config-module atomic write rule.

### Phase 2 — Closed definition validator

1. Add `lib/config/widgets.ts` types/constants for `MAX_WIDGETS_PER_ETF = 6`, operations, period
   units, definition, persisted widget, validation results, public operation results, and injected
   dependencies. Keep validation independent of SQL and I/O.
2. Add `lib/config/widgets.test.ts` table-driven validator tests for all five operations and both
   period units; amount boundaries 1 and 365, integer-only and out-of-range rejection; title
   absent/60-character acceptance and 61-character/type rejection; each closed error code;
   numeric-catalogue membership versus unknown/non-numeric fields; unknown keys and adversarial
   formula/code/expression/URL/free-form-field-shaped values. Assert malformed inputs return
   closed errors without throwing and that no value is evaluated.

### Phase 3 — Config functions, defaults and atomicity

1. Implement ETF resolution, catalogue construction and `listWidgetsForEtf`, `addWidget`,
   `updateWidget`, `clearWidget`, and `replaceWidgets` in `lib/config/widgets.ts`. All SQL stays
   here. Validate before constructing write statements. Each config call's writes use one
   `BatchRunner` call; replacement delete and all replacement inserts share that one call.
2. Add `lib/config/widgets.pglite.test.ts` using `createEmptyTestDatabase` and its real transaction
   runner. Cover public API reads and persisted results, ETF catalogue isolation, unknown ETF,
   unknown/unregistered adapter or field, first-free slot ordering, six-slot capacity and
   `too_many`, no overwrite when full, bad slot, rejected input with zero writes, partial update
   preservation, clear-one/clear-all isolation between ETFs, empty replacement, replacement
   ordering, rejection of any invalid replacement member before writes, and a forced mid-batch
   failure leaving the prior widget list intact. Use queries only against the `etfs`,
   `field_catalog`, and `etf_widgets` tables.
3. Wire `createWidgetsConfigDeps` into `lib/config/default-deps.ts`, supplying
   `neonBatchRunner(db)`, `defaultAdapterRegistry`, and `now`. Add a focused
   `lib/config/default-deps.widgets.test.ts` proving the factory returns the injected DB, runner,
   registry, and clock without network or environment access.
4. Extend `lib/config/boundaries.test.ts` so config widgets remain inside the accepted module
   boundary and the `etf_widgets` SQL writer is exactly `lib/config/widgets.ts`. Assert that no
   app/action/chat module contains widget SQL; leave future widget actions and their boundary
   coverage to US-045. Preserve the existing boundary checks.

### Phase 4 — Focused and project gates

1. Run the focused schema, migration, validator, PGlite config, default-deps, and config-boundary
   tests. Fix only failures attributable to US-043; do not weaken or delete tests.
2. Run `pnpm typecheck`, `pnpm lint`, the full `pnpm test`, and offline `pnpm build` under the
   repository's existing scripts. Build must use the existing production migration wrapper's
   non-production skip path; do not invoke it with production settings or a real database URL.
   Record exact outcomes in the independent tester's verdict, not this plan.

## Acceptance-criteria evidence map

| Criterion | Planned evidence |
|---|---|
| **AC1 — Persisted closed schema** | `lib/db/schema.test.ts` asserts the exact table export, columns, types, required/null columns, FK cascade, unique `(etf_id, slot)`, and checks. `test/helpers/pglite.migrations.test.ts` plus `lib/config/widgets.pglite.test.ts` attempt valid inserts and each invalid operation/unit/slot/amount, duplicate slot, and invalid ETF FK. Assert database rejection for every boundary, including out-of-range integer and fractional amount. |
| **AC2 — Expand-only migration path** | Generated `drizzle/0004_etf_widgets.sql`, `drizzle/meta/0004_snapshot.json`, and journal entry after 0003; inspect migration for only new-table creation and expected checks/FK/unique constraint. `test/helpers/pglite.migrations.test.ts` applies the complete journal in order, verifies table presence, cascade, and constraints in PGlite. Never use live migration commands/resources. |
| **AC3 — One closed validation gate** | `lib/config/widgets.test.ts` directly exercises `validateWidgetDefinition` for accepted boundaries, all operations/units, numeric catalogue allow/deny, every definition error, extra keys, malformed/untrusted values, and no-throw behavior. The PGlite API tests exercise `unknown_etf`, `bad_slot`, and `too_many`, with validation failures proven to issue no writes. |
| **AC4 — Add and update operations** | `lib/config/widgets.pglite.test.ts` proves add takes the first free slot, respects ordering, returns `too_many` at six without overwrite, rejects invalid input without writes, and that partial update changes only supplied fields while preserving all others. Include invalid ETF/slot and catalogue-key paths. |
| **AC5 — Clear and replace operations** | PGlite tests prove clear-one and clear-all are scoped to one ETF; replacement maps input order to slots, validates the full list before writes, handles empty lists, and uses one batch. Inject a batch failure and assert original rows remain unchanged. |
| **AC6 — Configuration boundary** | Public API PGlite tests cover reads/writes; `lib/config/boundaries.test.ts` proves sole config SQL ownership, absence of widget SQL in app/action/chat code, and no forbidden imports or `process.env` access. Config catalogue membership derives only from adapter field keys intersected with `field_catalog`; no raw extraction field is added or inferred. |
| **AC7 — Defaults and build gates** | Constant/schema/API tests prove six slots and per-ETF isolation; DEC-022 PW-1..PW-3 remain shipped defaults and require no user confirmation. Offline project gates: `pnpm typecheck`, `pnpm lint`, focused tests, `pnpm test`, and offline `pnpm build`. All tests use local PGlite, fake dependencies and no real secrets or services. |

## Expected files and ownership

**New**

- `dev_minions/verification/US-043-plan.md` (this plan)
- `drizzle/0004_etf_widgets.sql`
- `drizzle/meta/0004_snapshot.json`
- `lib/config/widgets.test.ts`
- `lib/config/widgets.pglite.test.ts`
- `lib/config/default-deps.widgets.test.ts`

**Changed**

- `lib/db/schema.ts`
- `lib/db/schema.test.ts`
- `test/helpers/pglite.migrations.test.ts`
- `lib/config/widgets.ts`
- `lib/config/default-deps.ts`
- `lib/config/boundaries.test.ts`
- `drizzle/meta/_journal.json`
- `dev_minions/architecture/data-model.md`

No runtime dependency, action, chat, page, locale, status-board, or HANDOVER change is expected.
Do not edit DEC-022/023, accepted decisions, requirements, or another agent's verdict.
