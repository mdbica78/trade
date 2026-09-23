# DEC-010 — US-003 schema FK nullability and Neon driver mode

Status: **Decided**
Validated by tech-lead subagent (in-loop, DEC-009), 2026-09-23: D1-B (NOT NULL FKs) is the only reading under which data-model.md's per-ETF UNIQUE keys and CASCADE semantics hold. D2-A (neon-http) fits one-shot serverless queries and is isolated to `lib/db/index.ts`. Both are reversible and neither affects product, cost or credentials.
Raised by: `story-planner`, during "plan US-003" (`verification/US-003-plan.md`, section 5).
Type: TECHNICAL (schema/tooling detail; no product, cost or credential impact).

## Context

`architecture/data-model.md` specifies the seven-table schema for US-003 but leaves two
implementation details unstated that the story-planner needs settled before writing
`lib/db/schema.ts` and `lib/db/index.ts`.

## Decision D1 — FK column nullability

`tracked_fields.etf_id`, `reports.etf_id` and `report_values.report_id` are documented as
`FK → ... ON DELETE CASCADE` without stating NULL/NOT NULL, unlike every other column in the
doc, which does state it.

**Options**
- A — Nullable (literal reading of the doc's silence). Risk: Postgres treats NULLs as distinct
  in a UNIQUE constraint, so `UNIQUE (etf_id, report_date)` would not stop duplicate rows that
  have a NULL `etf_id` — defeating AC2's stated purpose of preventing duplicate ingestion. An
  orphan report/value row would also be meaningless data.
- B — NOT NULL on all three FK columns.

**Recommendation: B.** Matches the doc's evident intent (one row per ETF per date; a CASCADE
child cannot meaningfully outlive its parent).

## Decision D2 — Neon driver mode for the app client

ADR-001 fixes the package (`@neondatabase/serverless`) but not the connection mode.

**Options**
- A — HTTP (`drizzle-orm/neon-http` + `neon()`). Stateless, lowest latency for one-shot
  queries from Vercel functions, no `ws` dependency, no pool lifecycle. No interactive
  transactions, but `db.batch([...])` runs non-interactive statements atomically — sufficient
  for Sprint 3 ingestion (upsert report, then values) given the unique-key idempotency.
- B — WebSocket Pool (`drizzle-orm/neon-serverless` + `Pool`). Full interactive transactions;
  needs `ws` on Node 20 and per-invocation pool connect/close handling in serverless.

**Recommendation: A (HTTP).** Only `lib/db/index.ts` knows the driver, so switching to B later
if Sprint 3 genuinely needs interactive transactions is a one-file change. `drizzle-kit migrate`
resolves its own driver regardless of this choice.

## Trade-offs summary

Both recommendations are cheap to reverse (one file / one doc edit) and neither touches product
scope, cost or credentials — appropriate for `tech-lead` to decide under DEC-009.

## Tech-lead validation 2026-09-23 — binding notes

Decided: **D1 = B** (NOT NULL on `tracked_fields.etf_id`, `reports.etf_id`, `report_values.report_id`)
and **D2 = A** (`drizzle-orm/neon-http` + `neon()`).

1. **D1 applies to US-003 now.** `schema.test.ts` must assert `notNull: true` on those three columns,
   and the generated SQL must contain the matching `NOT NULL`. This DEC is the authoritative amendment
   to `architecture/data-model.md`. The tech-lead subagent does not edit architecture docs, so the
   standing Technical Lead chat should add "NOT NULL" to those three rows and cite DEC-010. That doc
   edit does not block US-003.
2. **D2 carries a constraint for Sprint 3 ingestion.** neon-http has no interactive transactions, and
   drizzle's `db.transaction()` throws with this driver. Ingestion must not write a `reports` row with
   `status = 'ok'` in one call and its `report_values` in a second, independent call, because a failure
   between the two would leave an `ok` report with no values. That is a silent failure (FR13). Use one
   of these instead: (a) a single `db.batch([...])` where the values insert resolves `report_id` with a
   subquery on `(etf_id, report_date)`; (b) write the values first against a non-`ok` report row, then
   flip the status to `ok` last; or (c) switch `lib/db/index.ts` to the WebSocket `Pool` (option B)
   with a new DEC. The Sprint 3 ingestion story plan must say which one it uses.
3. The app client driver choice does not decide how `drizzle-kit migrate` connects. The plan's offline
   localhost smoke check (US-003 plan, section 1, risk 1) still applies. If it reports a missing `ws`,
   adding `ws` as a devDependency is pre-approved under this DEC.
