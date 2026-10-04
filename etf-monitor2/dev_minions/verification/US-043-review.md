# US-043 independent review

## Round 1 — 2026-10-03

Verdict: **PASS**

### Acceptance criteria

- **AC1 — Persisted closed schema: MET.** `lib/db/schema.ts` declares
  `etf_widgets` with the expected nine column fields, typed serial/integer/
  smallint/text/timestamptz storage, nullable title, and no JSON definition
  column or field-catalog FK. The table config defines the unique
  `(etf_id, slot)` pair, slot/operation/period-unit/amount checks, and
  cascading ETF FK. `lib/db/schema.test.ts` asserts the column set, metadata,
  checks, and cascade. The focused PGlite migration test rejects duplicate
  slots, invalid slot/operation/unit/amount values, fractional amount and
  invalid ETF reference, accepts valid boundary rows, and verifies cascade.
- **AC2 — Expand-only migration path: MET.** `drizzle/0004_etf_widgets.sql`
  adds only the new table and its FK; it contains no destructive or existing-
  table alteration. `drizzle/meta/_journal.json` registers
  `0004_etf_widgets` at index 4, after `0003_ai_provider_keys`.
  `test/helpers/pglite.migrations.test.ts` W-PM-1 applies the full journal
  through the test helper, verifies the new table/constraints and cascade.
  I independently ran that migration test as part of the focused suite; no
  live migration or database was used.
- **AC3 — One closed validation gate: MET.** `lib/config/widgets.ts`
  exports the single pure `validateWidgetDefinition` gate. It accepts only
  the five operations, two period units, integer period amounts 1–365,
  optional string titles up to 60 characters, and a numeric field in the
  supplied catalogue; extra definition keys and invalid values return only
  closed error codes. The ETF-scoped API resolves its catalogue from
  `field_catalog` intersected with the registered adapter's `fieldKeys`,
  rather than report data or labels. `lib/config/widgets.test.ts` covers
  every operation, both units and amount boundaries, title boundary/type,
  non-numeric/unknown fields, unsupported operations, extra keys, and
  malformed/formula/code/URL-shaped inputs. PGlite API tests cover the
  operation-level errors (`unknown_etf`, `bad_slot`, `too_many`) and verify
  rejected definitions leave the table unchanged.
- **AC4 — Add and update operations: MET.** `addWidget` validates before
  writing, selects the lowest unoccupied slot, and returns `too_many` when
  all six are occupied. `updateWidget` validates the merged definition and
  scopes its update by ETF and slot, preserving the other stored fields.
  `lib/config/widgets.pglite.test.ts` verifies slots 1–6, full-capacity
  refusal without overwrite, slot reuse after clearing, invalid input, and
  partial-title update preservation. No failure or overwrite path was
  identified in the inspected implementation.
- **AC5 — Clear and replace operations: MET.** Clear-one and clear-all SQL
  are scoped to the resolved ETF; replacement validates the entire input
  before constructing the delete/insert batch and maps input order to slots.
  `replaceWidgets` sends deletion and inserts through one `BatchRunner` call.
  Its PGlite test verifies clear isolation between ETFs, empty replacement,
  invalid and over-capacity replacement preservation, and that a forced
  mid-batch failure rolls back to the prior widget list.
- **AC6 — Configuration boundary: MET.** All widget SQL and the public
  validation/config API reside in `lib/config/widgets.ts`; concrete DB,
  adapter-registry and clock wiring is limited to
  `lib/config/default-deps.ts`. `lib/config/boundaries.test.ts` BC-11 guards
  widget SQL writers against `app/` and `lib/ai/`; the current source scan
  found no other production `etf_widgets` reader or writer. PGlite tests
  exercise the public API. No raw field or extraction change was introduced.
  **LOW coverage note:** BC-11's caller scan rejects `INSERT`/`UPDATE`/
  `DELETE` but does not reject a direct `SELECT` from `etf_widgets`.
  Current callers contain no such SQL, so this is a future regression-guard
  gap, not a criterion failure or an observed behavior defect.
- **AC7 — Defaults and build gates: MET.** The six-slot constant, slot checks
  and ETF-scoped SQL/tests establish per-ETF capacity and ownership. PW-1..3
  remain the DEC-022 defaults; no user step is required. I independently ran
  the focused US-043 suite (6 files / 83 tests), then `pnpm typecheck` (exit
  0), `pnpm lint` (exit 0, 0 errors / 9 warnings), `pnpm test` (exit 0,
  207 files / 2114 tests), and offline `pnpm build` (exit 0; migration
  runner skipped outside production; 12 dynamic routes). Before these
  commands, relevant DB/deployment/master-key/provider variables were
  removed from the process environment without reading or printing values.
  Tests used PGlite and local fakes; no live service or real key was used.

### Focused verification

Command:

```text
pnpm exec vitest run lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/config/widgets.test.ts lib/config/widgets.pglite.test.ts lib/config/default-deps.widgets.test.ts lib/config/boundaries.test.ts
```

The shell did not have bare `pnpm` on `PATH`; reran using the installed
`C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd` path. Exit code **0**;
**6 files / 83 tests passed**.

### Findings

No Critical or Warning findings. The AC6 LOW coverage note above does not
block the story.

Denied or attempted commands: none. No git command, `.env*`/credential file,
secret value, live resource, or `ai_provider_keys` row was accessed.
