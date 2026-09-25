# US-019 — Test verdict

**Story:** ETF detail page: time-series charts for tracked fields  
**Round:** 1  
**Date:** 2026-09-25

Verdict: **PASS**

## Command results

| Command | Exit code | Notes |
|---------|-----------|-------|
| `pnpm install --frozen-lockfile` | 0 | Lockfile current, supply-chain verified |
| `pnpm typecheck` | 0 | All type checks pass |
| `pnpm lint` | 0 | 0 errors; 3 pre-existing warnings in unrelated test files |
| `pnpm test` | 0 | 791/791 tests pass incl. 21 new US-019 tests |
| `pnpm build` | 0 | Successful with `DATABASE_URL` unset, `/etf/[symbol]` confirmed dynamic |

## Acceptance criteria coverage

All 8 acceptance criteria are tested:

### AC1 — One chart per tracked field
- `components/EtfDetail.test.tsx` "AC1: exactly one chart section per tracked field, in the given (display_order) order, and none for an untracked but stored field"
- `components/EtfDetail.test.tsx` "AC1: labels shown are the locale's catalogue label"
- `app/etf/[symbol]/page.test.tsx` "US-019 AC1/AC5: renders one chart section per tracked field, titled with the locale's label"

### AC2 — Series and gaps
- `lib/monitoring/chart-series.test.ts` "buildChartSeries (AC2)" — 9 tests covering ascending order, gaps with null values, no carry-forward, DST/year boundaries, timezone independence, malformed date handling
- `lib/monitoring/chart-series.pglite.test.ts` "buildChartSeries through the real read model, on PGlite (AC2/AC1)" — 3 tests including parse_error report handling and untracked field exclusion
- `components/FieldChart.test.tsx` "AC2: Line has connectNulls false, type linear, dataKey value, and a truthy dot"

### AC3 — Values read exactly
- `lib/format/chart.test.ts` "formatTooltip (AC3)" — 3 tests: date + display formatting, trailing zeros, gap points
- `lib/format/chart.test.ts` "formatAxisTick (AC3)" — 3 tests: no grouping character, exact cases, NaN/Infinity handling
- `components/FieldChart.test.tsx` "AC3: XAxis dataKey is date, and its tickFormatter wiring matches formatReportDate for the locale"
- `components/FieldChart.test.tsx` "AC3: XAxis tickFormatter for en gives the ISO date unchanged"
- `components/FieldChart.test.tsx` "AC3: YAxis tickFormatter applies the locale's decimal mark with no grouping"
- `components/FieldChart.test.tsx` "ChartTooltipContent" — 3 tests: formatted output when active, nothing when inactive, nothing for gap points

### AC4 — Empty states
- `components/EtfDetail.test.tsx` "AC4: no ok report -> no chart heading, no chart sections, chart mock never called"
- `components/EtfDetail.test.tsx` "AC4: no tracked fields -> no chart section at all"
- `components/EtfDetail.test.tsx` "AC4: status error -> no chart section"
- `components/EtfDetail.test.tsx` "AC4: a field with no value on any date shows the translated no-data message instead of a chart, the other field still gets one"
- `lib/monitoring/chart-series.test.ts` "hasAnyValue (AC4)" — 3 tests: empty array, all gaps, at least one value

### AC5 — Bilingual
- `i18n/messages.test.ts` "message catalogues have identical keys" — 4 tests for ro.json/en.json parity (2 pass tests + 2 drift detection tests)
- `app/etf/[symbol]/page.test.tsx` "US-019 AC1/AC5: renders one chart section per tracked field, titled with the locale's label"
- `components/EtfDetail.test.tsx` "ro and en renders never contain the other locale's differing state text"
- `app/etf/[symbol]/page.test.tsx` "ro and en renders never contain the other locale's differing text"

### AC6 — Dependency
- `test/package-config.test.ts` "package-config (US-019 AC6)" — 3 tests:
  - "pins recharts to an exact version" (verified `recharts@3.10.1` in package.json)
  - "pins react-is to the same version as react, if present" (pnpm resolved `react-is@19.2.8` to match React 19)
  - "leaves no unresolved build-approval entry in pnpm-workspace.yaml" (verified clean install)

### AC7 — Server/client boundary
- `components/FieldChart.boundary.test.ts` "FieldChart client boundary (US-019 AC7)" — 3 tests:
  - "starts with the client directive"
  - "never imports a database module, directly or via its value-imported modules"
  - "only imports lib/monitoring/history and lib/monitoring/chart-series as types"
- `components/EtfDetail.test.tsx` "AC7: the chart mock receives only plain, JSON-round-trippable props with exactly the expected keys"

### AC8 — Commands pass
- All 4 commands (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) exit 0. ✓

## Summary

- **Tests:** 21 new US-019 tests added (791/791 total pass)
- **Coverage:** All 8 acceptance criteria verified by focused unit/integration tests
- **Dependencies:** `recharts@3.10.1` pinned exactly, peer `react-is@19.2.8` auto-resolved
- **Build:** Passes with `DATABASE_URL` unset; `/etf/[symbol]` route confirmed dynamic
- **No blocking issues.** Ready for review.
