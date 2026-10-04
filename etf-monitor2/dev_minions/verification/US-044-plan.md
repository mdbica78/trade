# US-044 — Widget engine and history-area rendering

**Phase:** Plan  
**Round:** 0  
**Planning scope:** Implementation and test plan only; no application or test files changed.

## Binding sources and decisions

- Story: `dev_minions/backlog/stories/US-044.md` (AC1–AC7, drafted for PO confirmation).
- Sprint scope: `dev_minions/backlog/sprints/sprint-11.md`.
- Approved review: `dev_minions/verification/SPRINT-11-review.md`, especially “Deterministic
  engine and rendering”, “Historical coverage”, “Extraction boundary”, and “Optional schema and
  diagnostics”.
- Decision: `dev_minions/decisions/DEC-022-history-widget-definition.md` §§1–2, 8–9.
- Existing patterns inspected: `lib/monitoring/history.ts`,
  `lib/monitoring/delta.ts`, `lib/format/{delta,number,date}.ts`,
  `components/{EtfDetail,HistoryTable,HomeTable}.tsx`, and
  `app/etf/[symbol]/page.tsx`.

DEC-022 settles all US-044 behavior, including the six-slot stored definitions, operations,
window semantics, exact arithmetic, four-decimal average rounding, P7 percentage behavior,
localized output, and optional-table fallback. No new product or technical decision blocks this
plan. Keep widgets restricted to the existing numeric adapter catalogue; do not implement raw
fields, backfill, extraction, or chat behavior.

## Bounded design

1. **Share exact decimal primitives.** Extract the bigint decimal parsing, scale alignment,
   formatting, and rounding logic currently private to `lib/monitoring/delta.ts` into a pure
   reusable `lib/monitoring/exact-decimal.ts`. Preserve `computeDelta` and
   `previousCalendarDay` public behavior by delegating arithmetic to these primitives. Provide
   only the operations needed here: canonical validation, exact comparison, subtraction, and
   average-to-fixed-scale. Do not parse `numeric_value` through JavaScript `Number`, floats,
   `toFixed`, `Intl`, or `Date`; retain the existing `BigInt(...)` construction style required by
   the repository's ES2017 target.
2. **Keep calculation pure.** Add `lib/monitoring/widget-engine.ts` with typed input definitions,
   `ok` report dates and canonical field values, and a typed result carrying either
   `insufficient_history` or a canonical value plus basis dates. It performs no I/O, localization,
   logging, or database access.
3. **Periods and missing values.** Sort/consume only `ok` reports newest first. For `days`,
   derive the inclusive lower bound by applying the existing pure `previousCalendarDay` helper
   `periodAmount` times to the newest report date, then compare ISO dates as strings. For
   `reports`, select the newest `periodAmount` `ok` reports. Missing/non-canonical field values
   are skipped, never converted to zero. A change operation uses the latest available field value
   and the newest available field value on or before the day boundary, or the report
   `periodAmount` positions earlier for a reports period; if either required operand is absent,
   report `insufficient_history`. Return the actual dates of the operands. This follows DEC-022's
   “missing ... is skipped” rule and makes gaps explicit in tests.
4. **Exact operation semantics.**
   - `change`: use `computeDelta(current, comparison).absolute`, retaining the more precise input
     scale and exact signed difference.
   - `percent_change`: use `computeDelta(...).percent` (P7: two decimals, half away from zero,
     no signed zero); a zero comparison value yields a null value, not a fabricated percentage.
   - `average`: sum signed bigint coefficients at a common decimal scale, divide by the count using
     integer quotient/remainder, and round the magnitude up when `2 * remainder >= denominator`.
     Apply the original sum's sign after rounding; return exactly four decimal places as settled
     by DEC-022.
   - `min`/`max`: compare exact scaled bigint values, not lexically or as floats, and return the
     winning canonical input value.
   Aggregate basis dates are every report with a valid, present value actually considered,
   newest first. Change basis dates are the current and comparison reports, newest first. An empty
   candidate set yields `insufficient_history`.
5. **Read optional widget data independently of required history.** Extend
   `createEtfHistoryLoader` in `lib/monitoring/history.ts` only after its existing three required
   history statements succeed. Run a separate optional query against `etf_widgets`, joined to the
   ETF's `field_catalog` rows and its `ok` report/value rows. This keeps a missing optional table
   from aborting the required history batch. Filter definitions in TypeScript against both the
   joined catalogue entry and the registered adapter's `fieldKeys` (the numeric whitelist already
   used by US-043), preserving widget slot order. Compute with only these approved definitions.
   Report rows remain isolated for the engine so untracked-but-catalogued widget values are
   available without adding them to the history table or chart field list.
6. **Handle optional query errors locally.** Catch only failures from the separate widget query;
   call `logLoadError("etf-detail-widgets", error)` once and return the history with an empty
   computed-widget list. Do not retry, suppress errors from the required history queries, render
   exception text, or log an additional line in the page's existing `etf-detail` catch. This covers
   `42P01` and unrelated query errors while retaining the history page.
7. **Render in the detail component.** Add a presentational `CustomValues` component and pass its
   computed view data through `EtfHistory`. Render the translated section only when there are
   definitions, before the existing history/no-history/table/chart content. Show each widget's
   explicit title as ordinary React text, or build the fallback title from translated operation,
   field label, period amount, and translated day/report unit. Format numeric values with
   `formatNumber`, `formatDeltaAbsolute`, or `formatDeltaPercent`; format every basis date with
   `formatReportDate`. For `change`/`percent_change`, reuse the existing gain/loss/flat sign, tone,
   arrow and accessible arrow-label convention from `HomeTable`; flat uses the neutral dash.
   A zero-divisor percentage remains blank while retaining its basis dates; `insufficient_history`
   uses a short translated message and never displays zero.

## Acceptance-criterion and test matrix

| AC | Planned evidence |
|---|---|
| **AC1 — periods/latest (`FR18`, DEC-022 §2/PW-3)** | Table-driven pure-engine tests: no `ok` reports; ignore non-`ok` rows; newest report rather than calendar today; inclusive day boundary; month/year/leap-day and weekend gaps; day window versus same-size report window; latest-N report selection; exact report-count comparison offset. Assert result and basis dates. |
| **AC2 — changes (`FR18`, DEC-022 §2)** | Exact positive, negative, and zero changes and percentages; day-boundary report lookup across a gap; report-count-earlier lookup; absent comparison; missing current/comparison values skipped rather than treated as zero; zero divisor gives no percentage; operand basis dates are exact. |
| **AC3 — aggregates (`FR18`, DEC-022 §2/PW-2; DEC-007)** | Exact average/min/max; missing values excluded; no values gives `insufficient_history`; large and mixed-scale decimals; positive and negative half-away-from-zero average ties; 2-decimal percent half-away-from-zero on both signs; source guards and tests prove the value path has no float/`Number`/`toFixed` conversion. |
| **AC4 — basis dates (`FR18`, DEC-022 §§2, 8)** | Engine tests assert current/comparison dates and all present-value aggregate dates across gaps/weekends. Component tests assert each date is rendered through `formatReportDate` in both locales. |
| **AC5 — presentation (`FR18`, DEC-022 §§1, 8; DEC-007)** | `CustomValues.test.tsx` and `EtfDetail.test.tsx`: section precedes the history table; both locales; custom and generated titles; every operation format; signed change/percentage and gain/loss/flat affordance with accessible arrow text; localized dates and decimal mark; translated `insufficient_history`; no zero fallback; HTML-like title renders escaped as text. Verify section is absent for no definitions and current table/chart output remains intact. |
| **AC6 — optional failure (`FR18`, DEC-022 §8; DEC-019)** | PGlite loader test drops `etf_widgets` after required history has been loaded and asserts a normal history result, no custom area, and exactly one sanitized `[load-error] etf-detail-widgets` line. A separate injected-runner case makes the optional query fail with an unrelated error and asserts the same fallback, exactly one line, and no message/URL leakage. Required history-query errors retain the existing route error path. |
| **AC7 — scope/regression (`FR18–FR19`, DEC-022 §§1–2, 9)** | Loader tests reject/omit a stale or non-catalogue stored field key using the adapter/catalogue intersection, calculate only from `ok` stored values, and prove values absent from historic rows remain absent (no backfill/inference). Existing history/PDF extraction tests remain unchanged in behavior. Run focused arithmetic/widget/history/detail tests, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and an offline `pnpm build`; no live resource. |

The engine suite should include a small independent expected-value table for each operation and
window type. Avoid asserting only formatted strings: assert the canonical engine result and basis
dates before separately checking localization/rendering.

## Implementation sequence

1. Add `exact-decimal.ts`; refactor `delta.ts` to call it without changing existing exports or
   results; add utility tests and retain/run the current delta tests.
2. Implement the pure widget engine and its table-driven tests, including period-boundary,
   missing-value, zero-divisor, rounding, and basis-date cases.
3. Add the separate optional widget query and computed view data to `createEtfHistoryLoader`;
   test shipped SQL and parsing on PGlite, numeric-catalogue filtering, preservation of existing
   history, and both optional failure modes.
4. Add the bilingual presentational component and integrate it above existing history content;
   update current detail/page fixture shapes and add localized rendering/escaping/regression tests.
5. Run the focused suite, typecheck, lint, full suite, and offline build. Do not change schema or
   migration files; US-043 owns those.

## Expected files

**New**

- `lib/monitoring/exact-decimal.ts`
- `lib/monitoring/exact-decimal.test.ts`
- `lib/monitoring/widget-engine.ts`
- `lib/monitoring/widget-engine.test.ts`
- `components/CustomValues.tsx`
- `components/CustomValues.test.tsx`

**Changed**

- `lib/monitoring/delta.ts` and `lib/monitoring/delta.test.ts` — reuse/refactor exact bigint
  helpers while preserving current delta/date behavior.
- `lib/monitoring/history.ts` and `lib/monitoring/history.pglite.test.ts` — optional definitions
  and history values query, catalogue filtering, isolated fallback/logging, and computed view data.
- `lib/config/boundaries.test.ts` — assert `config/widgets.ts` remains the sole writer and
  `monitoring/history.ts` the sole `etf_widgets` reader.
- `components/EtfDetail.tsx`, `components/EtfDetail.test.tsx`, and
  `components/EtfDetail.chart-types.test.tsx` — area placement and fixture updates without
  changing existing table/chart behavior.
- `app/etf/[symbol]/page.test.tsx` — preserve route-level history rendering with the extended
  loader result and exercise the no-widget fallback through the page wiring.
- `messages/en.json` and `messages/ro.json` — heading, operation-specific fallback titles,
  period units, basis-date label, insufficient-history text, and accessible arrow labels if
  existing `Home` keys are not suitable in the `EtfDetail` namespace.

No new dependency, migration, database schema, PDF/extraction, chat, home-table, status-board, or
HANDOVER change is in scope.
