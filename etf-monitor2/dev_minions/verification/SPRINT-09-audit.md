# Sprint 9 audit

**Verdict: FINDINGS**

## Scope and method

Reviewed `AGENTS.md`, `dev_minions/roles/technical-lead.md`, `dev_minions/backlog/sprints/sprint-09.md`, the approved `SPRINT-09-review.md`, all seven Sprint 9 stories, the latest review/test verdicts and QA checklists/runs, `status.md`, and the current `HANDOVER.md`. Independently inspected relevant migration-guard, ingestion, home-read-model, chart, and contrast-procedure source.

This audit ran no tests, builds, git commands, live database operations, or deployment commands. Test/build results below are the latest reported evidence in the cited verdicts, not reruns by this audit. No files other than this audit were edited.

## Story disposition

| Story | Audit result | Evidence |
|---|---|---|
| US-048 | **Critical finding; recommend reopen** despite user acceptance and recorded QA PASS. See C1. | Story board: `status.md` US-048 row. Review/test/QA: `US-048-review.md`, `US-048-tests.md`, `US-048-qa.md`, `US-048-qa-run.md`. Guard and deployment gate: `lib/deploy/migrate.ts:76-110`, `scripts/migrate-on-deploy.ts:5-15`. |
| US-035 | No material finding. QA is PASS; its remaining visual comparison is recorded as a user-judgment item, not an implementation failure. | `US-035-review.md`, `US-035-tests.md`, `US-035-qa.md`, `US-035-qa-run.md`; spot-checked the theme/token and header implementation. |
| US-037 | No material finding. Round 2 review/tests and Codex QA are PASS. The earlier review's test-coverage observations remain non-blocking; no contrary behavior was found in the inspected filing/budget path. | `US-037-review.md` and `US-037-tests.md` round 2; `US-037-qa.md`, `US-037-qa-run.md`; spot-checked `lib/ingestion/ingest-etf.ts`, `lib/ingestion/run-daily.ts`, and `lib/ingestion/store.ts`. |
| US-047 | No material finding. Review/tests and Codex QA are PASS. | `US-047-review.md`, `US-047-tests.md`, `US-047-qa.md`, `US-047-qa-run.md`; spot-checked the home-display save/read paths and fallback. |
| US-036 | No material finding. Review/tests and Codex QA are PASS. | `US-036-review.md`, `US-036-tests.md`, `US-036-qa.md`, `US-036-qa-run.md`; spot-checked `lib/monitoring/home.ts:151-190,371-379` and `components/HomeTable.tsx`. |
| US-038 | No material implementation finding. Review round 2 and tests round 1 are PASS. Codex QA is not yet run; this is a Note only. | `US-038-review.md` round 2, `US-038-tests.md`, `US-038-qa.md`; `status.md` US-038 row; spot-checked `components/FieldChart.tsx:154-179`. `HANDOVER.md:64-67` records that the full suite was not rerun after a README-only edit; the focused README tests passed. |
| US-039 | No material finding. Review/tests are PASS. Codex QA is not yet run; this is a Note only. | `US-039-review.md` round 2, `US-039-tests.md`, `US-039-qa.md`; `status.md` US-039 row. The revised opacity handling in `US-039-qa.md` §4 classifies affected contrast measurements as unverified rather than passing an uncomposited ratio. |

## Critical finding

### C1 — US-048 — Production migration guard can skip destructive SQL in a CREATE TABLE block

`guardMigrationStatements` splits migration text only at Drizzle's `--> statement-breakpoint` marker (`lib/deploy/migrate.ts:84-88`). It then skips the entire resulting block whenever that block begins with `CREATE TABLE` (`lib/deploy/migrate.ts:90-91`). Consequently, a valid migration block such as:

```sql
CREATE TABLE "new_table" ("id" integer);
DROP TABLE "existing_table";
```

with no breakpoint between those commands is accepted by the guard: the block matches `CREATE_TABLE_RE`, is skipped, and never reaches the `DROP_RE` check. The production build script checks this guard and calls the migration runner when it reports no violations (`scripts/migrate-on-deploy.ts:5-15`), so a destructive command in this form can pass the intended pre-migration safety gate and may be applied by the migration executor.

The current test cases cover a standalone `DROP TABLE` and a `CREATE TABLE` block separately (`lib/deploy/migrate.test.ts:95-103`); they do not cover a destructive command after `CREATE TABLE` in the same block. The current `0002_home_display_settings.sql` uses breakpoints between its commands and contains no destructive statement, so this audit found no evidence that an existing migration uses the bypass. That does not establish the guard's required expand-only guarantee for future migrations.

**Recommendation:** reopen US-048 and fix the guard so it exempts only the `CREATE TABLE` command itself, not all SQL in its breakpoint block. Add a regression test containing a `CREATE TABLE` followed by `DROP TABLE` in one block and require the guard to report `DROP`. The story is recorded as accepted/Done in `status.md`; this audit recommends reopening it but does not change the status board.

## Warnings

### W1 — US-038 handover contains contradictory phase text

`HANDOVER.md:54-59` says US-038 has no implementation and AC1–AC8 remain to implement, then immediately records the implementation and successful gates; `HANDOVER.md:64-67` again says AC1–AC8 are implemented and there are no failing tests. The status board correctly records US-038 as Awaiting QA. This is stale handover text that could misdirect a resuming agent. Correct it in the next permitted handover update; it does not indicate missing story implementation and does not warrant reopening US-038.

### W2 — US-038 command hygiene incident has unresolved exposure status

The independent review records that a grouped gate-shell invocation emitted an ambient environment listing (`US-038-review.md`, “Command hygiene” and Round 2); `HANDOVER.md:87-90` says no values were reproduced and no such command was retried. This audit did not retrieve or reproduce that output. The records do not establish whether any sensitive value appeared in the transient output, so the potential exposure cannot be assessed from the retained evidence. Treat this as an unverified process incident under DEC-015; do not repeat the command or copy any output into the repository. No evidence of a persisted secret in Sprint 9 artifacts was identified by this audit.

## Notes

- Codex QA is not yet run for US-038 and US-039 (`status.md`, those story rows). Per the audit instructions, this is informational only and is not a blocker.
- The latest US-035/US-036/US-047 QA records retain visual comparison or judgment items. Those are not material code findings in this audit.
- No large test suite or build was run for this audit; all cited gate results remain the verdict authors' reported evidence.
