# Sprint 11 audit — Programmable history area

**Date:** 2026-10-03  
**Verdict: PASS — no Critical or Warning findings; no story reopen recommended.**

## Scope and evidence

Independently compared `backlog/sprints/sprint-11.md` and US-043–046 with the
approved `SPRINT-11-review.md`, DEC-022, their plans, independent review and
test verdicts, QA checklists, the status Story board, and the implementation
and documentation cited below. The four story files retain FR-cited, PO-draft
criteria and the approved order/dependencies. The latest available demo
(`DEMO-20260928-1300.md`) predates Sprint 11 and contains no acceptance of
these stories. The Story board correctly leaves all four **Awaiting QA**, not
Done.

This is an independent source/document audit, **not a rerun of tests, lint,
typecheck or build**. The gate counts below belong to the named independent
test verdicts, not to this audit. I made no live request or migration and
did not access any secret value, credential file, environment file or
secret-bearing database row. No git command was run. Only this audit file
was written.

## Story and cross-story checks

| Story / criteria | Audit result and independently inspected evidence | Verdict evidence |
|---|---|---|
| **US-043 AC1–AC2** | **MET on inspected implementation.** `lib/db/schema.ts` defines a per-ETF six-slot, checked, unique, cascading `etf_widgets` table; `drizzle/0004_etf_widgets.sql` adds only that table and FK. The journal-order PGlite constraint/cascade case exists as W-PM-1 in `test/helpers/pglite.migrations.test.ts`. No definition JSON column or raw-field table was added. | `US-043-review.md` and `US-043-tests.md` round 1 PASS; the latter reports the focused 6-file/83-test and full 207-file/2114-test passes, typecheck, lint and offline build. |
| **US-043 AC3–AC6** | **MET on inspected implementation.** `lib/config/widgets.ts` centralizes strict definition validation and ETF/adapter-catalogue intersection, first-free add, partial update, ETF-scoped clear and whole-list validation before one-batch replace. `lib/config/widgets.pglite.test.ts` covers capacity, isolation and rollback; `lib/config/boundaries.test.ts` guards callers. The matching data-model write rule is documented. | Round-1 review and tests PASS, criterion-by-criterion; the review's direct-SELECT boundary-guard coverage gap is non-blocking, not an observed caller violation. |
| **US-043 AC7** | **MET per independently reported gates; not re-run here.** Six slots and per-ETF ownership also appear in schema and config source. `US-043-qa.md` ends with its file inventory and preserves offline/migration cautions. | `US-043-tests.md` round 1. |
| **US-044 AC1–AC4** | **MET on inspected implementation after the round-1 fix.** `lib/monitoring/widget-engine.ts` uses only `ok` reports, day/report windows, exact-decimal helpers, skips absent values and returns actual operand/contributing dates. Report-count comparison now begins at `latestIndex + periodAmount`, avoiding the false self-comparison identified in round 1. `lib/monitoring/widget-engine.test.ts` includes the missing-latest-value regression. | `US-044-review.md` round 1 FAIL on AC2/AC4, round 2 PASS on the fix; `US-044-tests.md` PASS reports focused 8-file/108-test and full 210-file/2142-test passes and offline gates. |
| **US-044 AC5–AC7** | **MET on inspected implementation.** `lib/monitoring/history.ts` makes the widget read optional and separate from required history, intersects its field with the adapter catalogue, and evaluates stored untracked values without changing tracked history. `components/CustomValues.tsx` renders translated values, dates, safe text titles and insufficient-history treatment above the unchanged history area. `history.pglite.test.ts` includes absent-table and unrelated-query-error cases with one sanitized log. `US-044-qa.md` includes RO/EN and post-push checks. | Round-2 review PASS (round-1 evidence retained), round-1 tests PASS. |
| **US-045 AC1–AC4** | **MET on inspected implementation.** `lib/ai/capabilities/action-list.ts` accepts a closed 1–5 action envelope; `widgets/intent.ts` restricts all four actions and reuses the config validator. `lib/ai/chat.ts` validates every action against the loaded pre-execution configuration/widget context before calling `executeActions`. `lib/ai/chat.test.ts` and its PGlite companion contain mixed-list and zero-writes-on-invalid cases. The model's prompt/context and provider boundary are covered in the review and focused tests. | `US-045-review.md` round 2 PASS; `US-045-tests.md` round 2 PASS reports 19 files/294 focused tests and 214 files/2203 full tests plus typecheck, lint and offline build. |
| **US-045 AC5–AC8** | **MET on inspected implementation after the round-1 fix.** `configurationOutcomeFailed` classifies the four returned failure codes; `executeActions` stops, marks that action `failed` and subsequent actions `not_run` while preserving prior successes and intentional no-ops. `widgets/execute.ts` calls config functions, and replace remains one batch. RO/EN supported-request and result strings and the QA checklist cover the four widget actions and action limit. No widget implementation added raw-label extraction or changed Sprint 10 key storage. | Round-1 review FAIL (returned configuration failures), round-2 review PASS; round-2 tester explicitly exercised returned failures and both mixed-capability orders. |
| **US-046 AC1–AC4** | **MET within the documented evidence boundary.** `US-046-spike.md` compares existing BRD and InterCapital adapter/fixture/catalogue rules with unsupported versus future explicitly mapped labels, discusses historical-data limits, and makes no implementation authorization. The product outcome remains **PROPOSED — NEEDS USER**. The round-1 AC4 evidence gap was addressed with a bounded file-modification-metadata check in review round 2; I repeated a same-cutoff enumeration (details below). This cannot establish git provenance or detect preserved timestamps. | `US-046-review.md` round 1 FAIL on AC4, round 2 PASS with explicit limitations; `US-046-tests.md` round 2 PASS is documentary verification, with **no test/build run**. `US-046-qa.md` is a documentation-only handoff with its file inventory. |

The combined path remains catalogue-only: the config validator resolves the
ETF's numeric adapter/catalogue intersection; the optional history reader
uses that intersection and stored `ok` values; the chat widget actions call
the same config layer. Historical missing values are skipped, not backfilled
or interpreted as zero. Migration 0004 is locally tested and belongs to the
existing production-build migration path, not a manual Neon step.

## Findings and disposition

- **Critical: none. Warning: none.** The two earlier implementation Criticals
  (US-044 operand selection and US-045 returned-failure reporting) have
  specific round-2 fixes and review PASS; no unresolved Sprint 11 criterion
  or cross-story contradiction was found. **Reopen: none** on this audit's
  evidence.
- **Note — Codex QA lag, not a blocker.** No
  `US-043-qa-run.md` through `US-046-qa-run.md` exists yet. Their development
  verdicts and QA checklists exist; the separate Codex QA loop may run later.
  This is **not** a Critical, Warning, or reason to reopen a story.
- **Note — product question is not a defect.** Sprint 11 P-1 and the US-046
  spike leave raw report-label support **PROPOSED — NEEDS USER**. The
  catalogue-only default in US-043–045 remains valid; any future raw-field
  work requires a separate authorized scope, not a retroactive Sprint 11
  implementation or a blocker.
- **Note — documentation freshness.** The status Story board reflects
  Awaiting QA, but its high-level Sprint 11 “Where we are” row still says
  “Not detailed”; `HANDOVER.md` still calls the US-046 QA checklist the
  “exact next step,” although that checklist now exists. These are stale
  summaries, not missing implementation or acceptance. This audit does not
  edit either file.
- **Note — bounded US-046 change-set evidence.** I independently listed
  filenames and modification times since 2026-10-03 10:53 local in `app`,
  `components`, `lib`, `drizzle`, `messages`, `test`, `spikes`, and
  `dev_minions/verification`, without opening secret files. The only matching
  names were `US-045-tests.md`, `US-045-qa.md`, `US-046-spike.md`,
  `US-046-review.md`, `US-046-tests.md` and `US-046-qa.md`, all in
  `dev_minions/verification`. No implementation file in those directories
  had a post-cutoff modification time. File metadata cannot prove authorship,
  detect timestamp-preserving edits, or attest to directories outside this
  enumeration; neither the spike's nor this audit's AC4 conclusion claims
  more.

The existing independent verdicts disclose their command attempts; no
prohibited git/secret/live command was observed in the reviewed verdict
records. I did not read automation logs or retry any denied command.

**Denied or attempted commands:** none.
