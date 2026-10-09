# US-019 — QA checklist

Round 1: review PASS (`US-019-review.md`), tests PASS (`US-019-tests.md`). No fix loop needed.
Two Warning-level HANDOVER-prose findings from the review were corrected in place (react-is
dependency description, new-test count); neither was a code defect.

## Automated (already run, no live resource)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (with `DATABASE_URL` unset) — all
  green. 791/791 tests, including the new `lib/monitoring/chart-series.test.ts`,
  `lib/monitoring/chart-series.pglite.test.ts`, `lib/format/chart.test.ts`,
  `components/FieldChart.test.tsx`, `components/FieldChart.smoke.test.tsx`,
  `components/FieldChart.boundary.test.ts`, `test/package-config.test.ts`, plus new cases in
  `components/EtfDetail.test.tsx` and `app/etf/[symbol]/page.test.tsx`.
- `pnpm build` output confirms `ƒ /etf/[symbol]` — still dynamic.
- `pnpm-lock.yaml` confirms `recharts@3.10.1` resolves its `react-is` peer to `19.2.8`
  (`package.json` pins `react-is` explicitly at the same version as `react`, plan R2's named
  exception). No other new runtime dependency.
- `test/package-config.test.ts` guards `pnpm-workspace.yaml` against an unresolved
  build-approval placeholder (the US-008 round 1 failure mode) — passes.
- No live BVB/Neon/Vercel call in any test — the series builder and its PGlite proof run against
  an in-memory database, and the chart component/page tests mock `recharts`/`./FieldChart`.

## Manual (live, user or Codex QA loop)
1. **sprint-04.md steps 6–7, chart part.** Open `/etf/BTBETRETF` on the deployment. Below the
   history table, a "Grafice" heading is followed by one chart per tracked field, in the same
   order as the table's columns, each titled like the column header (e.g. "Unități de fond în
   circulație", then "Valoare unitară a activului net (VUAN)"). Each chart draws a line with a
   visible dot on every stored day.
2. The line breaks (no line drawn) on every calendar day with no row in the history table —
   expected to happen roughly weekly under US-012 PRODUCT 2. An ETF with only one stored day
   shows a single dot, no line.
3. Hover the newest point: tooltip shows "Dată: dd.MM.yyyy" and "<label>: <value>" with a decimal
   comma and no grouping, matching the newest history-table row digit for digit. Hovering a gap
   day shows no tooltip value.
4. Y-axis ticks: no thousands separator (e.g. `37470000`, not `37.470.000`), decimal comma.
   X-axis ticks: `dd.MM.yyyy`.
5. Switch to EN: heading becomes "Charts", English field labels, ISO dates on the X axis and in
   the tooltip, decimal dot.
6. Open DevTools → Console on the detail page: no React hydration error, no Recharts error. The
   initial "width(0) and height(0)" warning (if any) must not repeat after the chart has loaded.
7. **Codex QA loop, local (`scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/etf/BTBETRETF`
   still shows the translated error state, not a crash — no chart is expected without a database.
   Codex can also independently re-run `pnpm test` / `pnpm build` and the clean-install proof
   (`rm -rf node_modules && pnpm install --frozen-lockfile` exits 0); it cannot check the drawn
   chart itself.
8. **PO to confirm** (non-blocking): styling defaults — auto-scaled Y axis (not from 0), single
   line colour, dashed grid lines, no tooltip on a gap day — and drafted copy `EtfDetail.chartsHeading`
   = "Grafice" / "Charts", `EtfDetail.noFieldData` = "Nu există date pentru acest câmp." / "No
   data for this field." Compare overall look with the chart on the instrument's bvb.ro page
   (style only, not an automated criterion).

## Files changed
- New: `lib/monitoring/chart-series.ts`, `lib/monitoring/chart-series.test.ts`, `lib/monitoring/chart-series.pglite.test.ts`
- New: `lib/format/chart.ts`, `lib/format/chart.test.ts`
- New: `components/FieldChart.tsx`, `components/FieldChart.test.tsx`, `components/FieldChart.smoke.test.tsx`, `components/FieldChart.boundary.test.ts`
- New: `test/package-config.test.ts`
- Edit: `components/EtfDetail.tsx`, `components/EtfDetail.test.tsx`
- Edit: `app/etf/[symbol]/page.test.tsx`
- Edit: `messages/ro.json`, `messages/en.json`
- Edit: `package.json`, `pnpm-lock.yaml` (added `recharts@3.10.1`, `react-is@19.2.8`, exact)
