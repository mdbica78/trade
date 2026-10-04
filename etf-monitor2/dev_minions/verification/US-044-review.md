# US-044 independent review

## Round 1 — 2026-10-03

Verdict: **FAIL**

### Acceptance criteria

- **AC1 — Periods/latest report: MET.** `evaluateWidget` filters to `status === "ok"`,
  orders by report date descending, anchors the day boundary to the newest accepted
  report, and uses the inclusive date comparison / latest report-count slice. The
  engine tests cover non-`ok` rows, inclusive dates, day versus report windows,
  gaps, and a leap-day boundary (`lib/monitoring/widget-engine.ts`,
  `lib/monitoring/widget-engine.test.ts`). I did not re-run tests.
- **AC2 — Change operations: NOT MET.** The report-period comparison offset is
  applied to `ordered` rather than to the latest report containing the field.
  When the newest `ok` report has no value, `latest` can be at index 1 or later,
  but `ordered.slice(definition.periodAmount)` can select that same report as
  `earlier`. For example, with reports (newest first) `2026-10-05: null`,
  `2026-10-04: 12`, `2026-10-03: 10`, a `reports`/1 change returns `0` with
  basis dates `2026-10-04, 2026-10-04`; the one-report-earlier value relative to
  the latest available field value is `10` on `2026-10-03`, so the change should
  be `2`. The missing-latest-field test covers a day period where the comparison
  remains distinct, but there is no corresponding report-period regression
  case (`lib/monitoring/widget-engine.ts:37-46`,
  `lib/monitoring/widget-engine.test.ts:70-78`). This violates the report-count
  comparison rule in AC2 and DEC-022 §2. Anchor the comparison offset to the
  selected latest field report and add a test asserting distinct operand dates
  when the newest report's field is missing.
- **AC3 — Aggregate operations/exact arithmetic: MET.** Aggregates skip missing
  or non-canonical values, return `insufficient_history` for an empty window,
  and use shared bigint decimal helpers for average/min/max. The exact-decimal
  and engine tests cover mixed scales, large values, signed average rounding,
  and comparison/percentage behavior (`lib/monitoring/exact-decimal.ts`,
  `lib/monitoring/exact-decimal.test.ts`,
  `lib/monitoring/widget-engine.test.ts`). I did not re-run tests.
- **AC4 — Basis dates: NOT MET.** In the AC2 case above, the engine reports the
  same report date twice rather than the two distinct reports that should form
  a report-count change comparison. Aggregate basis dates and normal change
  basis dates are carried through and formatted in the UI, but this comparison
  case fails its basis-date contract (`lib/monitoring/widget-engine.ts:37-46`,
  `components/CustomValues.tsx:48-50`).
- **AC5 — Detail-page rendering: MET.** `CustomValues` renders only when widgets
  exist, uses translated labels and operation-specific formatting, displays
  basis dates through `formatReportDate`, uses the existing change arrow/tone
  helpers, and renders titles as React text. Component tests cover Romanian and
  English, signed/flat changes, aggregates, insufficient history, basis dates,
  and escaped title text; the detail/page tests check placement above the table
  and preservation of table/chart output (`components/CustomValues.tsx`,
  `components/CustomValues.test.tsx`, `components/EtfDetail.test.tsx`,
  `app/etf/[symbol]/page.test.tsx`).
- **AC6 — Optional-table/read failures: MET.** The widget query is separate
  from required history reads; only its local failure is caught, logged once
  through `logLoadError`, and converted to an empty widget list. PGlite tests
  cover missing `etf_widgets` and an unrelated query error, checking that
  history remains available and the diagnostic is sanitized
  (`lib/monitoring/history.ts:173-200`,
  `lib/monitoring/history.pglite.test.ts`, `app/etf/[symbol]/page.tsx`).
- **AC7 — Scope/regression: MET.** The optional read intersects adapter
  `fieldKeys` with catalogue rows and reads `ok` reports only; history rows and
  charts continue to use their existing tracked-field query. PGlite coverage
  checks untracked widget values, catalogue rejection, and non-`ok` report
  exclusion; the boundary test covers the widget reader/writer split. The
  handover reports typecheck, lint, full tests, and offline build passing, but I
  did not independently re-run those gates; the separate test verdict remains
  pending.

### Finding

- **Critical — report-count change can compare a field value with itself.**
  `evaluateWidget` finds the latest report containing a value, then chooses the
  comparison with `ordered.slice(periodAmount)`, which is not relative to that
  report when earlier reports are missing the field. It can therefore display
  a false zero and duplicate basis date instead of the actual change
  (`lib/monitoring/widget-engine.ts:37-46`). AC2 and AC4 are NOT MET until the
  comparison is anchored to the selected current report and the missing-latest-
  field case is tested.

### Review scope

Read AGENTS.md, HANDOVER.md, the US-044 story and plan, Sprint 11 review,
DEC-022, and the implementation/tests listed above. No source or test file was
edited. No tests or build gates were re-run. No live resource or secret was
accessed.

Denied or attempted commands: none.

## Round 2 verdict

Date: 2026-10-03

Verdict: **PASS**

### Re-review of the failing criteria

- **AC2 — Change operations: MET.** `evaluateWidget` still filters to `ok`
  reports and sorts newest first, then finds `latestIndex` from the first report
  with a valid value for the configured field. For report periods it now starts
  the earlier-value search at
  `latestIndex + definition.periodAmount`, rather than applying the count offset
  to the full report list. This fixes the Round 1 false self-comparison when
  the newest report lacks the field. The regression case with
  `2026-10-05: null`, `2026-10-04: 12`, `2026-10-03: 10` and `reports`/1
  expects value `2` and operands on October 4 and October 3. The adjacent
  insufficient-history case confirms a missing earlier operand does not become
  a false zero (`lib/monitoring/widget-engine.ts:36-48`,
  `lib/monitoring/widget-engine.test.ts:70-82`,
  `dev_minions/decisions/DEC-022-history-widget-definition.md:19-25`).
  `change` and `percent_change` share this operand-selection branch; existing
  percentage tests continue to cover signed rounding and a zero divisor.
- **AC4 — Basis dates: MET.** The engine returns the dates of the selected
  current and earlier reports, newest first. The new report-period regression
  asserts the exact distinct dates `["2026-10-04", "2026-10-03"]`, closing the
  duplicate-date failure from Round 1. Rendering those dates through the
  existing report-date formatter was already covered by the Round 1 evidence
  (`lib/monitoring/widget-engine.ts:44-48`,
  `lib/monitoring/widget-engine.test.ts:77-82`,
  `components/CustomValues.tsx:48-50`).

### Remaining criteria and scope

AC1, AC3, and AC5–AC7 retain their Round 1 **MET** evidence; they were not
reopened because this fix is confined to report-period operand selection and
its basis dates. The Round 1 Critical finding is resolved. I inspected the
implementation and regression assertions directly; I did not re-run tests or
build gates.

No application or test files were edited during this review. No live resource
or secret was accessed.

Denied or attempted commands: none.
