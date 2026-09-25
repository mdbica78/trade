# US-019 — Plan: ETF detail page, time-series charts for tracked fields
Planned by `story-planner`, 2026-09-25. Story: `backlog/stories/US-019.md`. The tech-lead approved it
with in-place fixes in `SPRINT-04-review.md`: AC2's PGlite `parse_error` proof, the dot on every point,
and the AC6 peer-dependency exception. This plan builds on US-018 (Awaiting QA):
`lib/monitoring/history.ts` (`EtfHistory`, `HistoryRow`), `components/EtfDetail.tsx`,
`app/etf/[symbol]/page.tsx`, `lib/format/{number,date}.ts`, and `test/helpers/pglite.ts`.

No new decision is needed. Decision 1 (one chart per field) is Decided. Decision 2 (gaps and
time range, sprint-04.md #12) is PRODUCT and non-blocking. The story says "This story implements"
option A, so this plan implements A: break the line at every missing calendar day and show the whole
history with no range selector. The Recharts major version (§5 R1) is a version choice inside
ADR-001's library choice, the same as the `unpdf` pin. It is not a DEC.

This is the first `"use client"` module in the repo. There is none today.

## 1. Acceptance criteria → tests

| AC | Restated | Proven by |
|---|---|---|
| AC1 | Exactly one chart per tracked field, in `display_order` then `field_key` order, titled with the locale's catalogue label. An untracked field has no chart, even when values for it are stored. | **Component**, `components/EtfDetail.test.tsx` with `./FieldChart` mocked (§4.4). (a) Three fields given in the order `[b_field, a_field, c_field]` → exactly three `data-chart-field="…"` sections, in that order (compare `indexOf`), each with an `<h3>` holding `labelRo` in `ro` and `labelEn` in `en`. The mock was called three times, with `labels.series` equal to that label. (b) `rows[].values` also holds a key `net_asset`, which is not in `fields` → there is no `data-chart-field="net_asset"`, and the mock was never called for it. The order comes from the `fields` array, whose SQL order US-018 AC3(b) already proves on PGlite. EtfDetail does not re-sort it. **End to end (PGlite)**, `lib/monitoring/chart-series.pglite.test.ts`: an ETF tracks `nav_per_unit` and stores `nav_per_unit` + `net_asset` → `history.fields` is exactly `nav_per_unit`. Building one series per `fields` entry gives one series, and `net_asset`'s value appears nowhere in `JSON.stringify` of the series. **Page**, `app/etf/[symbol]/page.test.tsx`, `ro` and `en`, with `@/components/FieldChart` mocked: two tracked fields → two sections, each with its heading and its `data-chart-container` div (story Task 7). |
| AC2 | Series and gaps. Ascending, one point per calendar day from the oldest to the newest `ok` date. 09-21 + 09-23 → three points, and 09-22 is `null`/`null`. `parse_error` contributes nothing (PGlite). No interpolation, no carry-forward. The line has `connectNulls={false}` and a dot on every point that has a value. | **Pure**, `lib/monitoring/chart-series.test.ts`: (a) rows for 09-21 and 09-23, passed newest first as the read model gives them, and again shuffled → `[09-21, 09-22, 09-23]`, with 09-22 `{ value: null, display: null }`. (b) 09-23 lacks the field and 09-21 has it → the 09-23 point is `null`/`null`, not the 09-21 number (no carry-forward). (c) Every point's `display` is either `null` or a string present in the input rows for that exact date. `value` is `Number(display)` or `null`. No point has a value that is not in the input (no interpolation). (d) One row → one point. `rows: []` → `[]`. (e) Ranges across DST changes (2026-03-28..03-30 and 2026-10-24..10-26) and across a month or year end (2026-12-30..2027-01-02) have exactly one point per day. (f) The same result when `process.env.TZ` is set in the test to `America/Los_Angeles` and to `Pacific/Kiritimati`, restored in `finally`. (g) A malformed date (`"2026-13-45"`) throws, and does not loop forever. **PGlite**, `chart-series.pglite.test.ts`: `ok` 09-21 `nav_per_unit = "11.1"`, `parse_error` 09-22 with a stored `nav_per_unit = "999"`, `ok` 09-23 `"11.3"`, through `createEtfHistoryLoader(db.mockDb, db.runner)` then `buildChartSeries` → three points, 09-22 `null`/`null`, `"999"` and `999` absent. A second case adds a `parse_error` on 09-24, **after** the newest `ok` → the series still ends at 09-23. **Line props**, `components/FieldChart.test.tsx` with `recharts` mocked (§4.4): `Line` got `connectNulls === false`, `type === "linear"`, `dataKey === "value"`, and a truthy `dot` (not `false`, not omitted). `LineChart` got `data` deep-equal to the `points` prop. |
| AC3 | The tooltip is the formatted date plus `formatNumber(display)`: `54.1373` → `54,1373` (`ro`) / `54.1373` (`en`). The Y ticks have no grouping character. The tooltip and tick functions are pure and unit-tested. | **Pure**, `lib/format/chart.test.ts`: `formatTooltip({ date: "2026-09-22", value: 1, display: "54.1373" }, "ro")` → `{ date: "22.09.2026", value: "54,1373" }`, and `"en"` → `{ date: "2026-09-22", value: "54.1373" }`. The deliberately wrong `value: 1` proves the text comes from `display` (story Notes: "the tooltip formats `display`, not `value`"). A trailing-zero `display` `"11.1700"` stays `11,1700`. A gap point → `null`. `formatAxisTick(n, locale)` over `[0, -5, 11.2, 0.1 + 0.2, 1234567, 1234567.891, 400000000, 1e15]`: every `ro` result matches `/^-?\d+(,\d+)?$/` and every `en` result matches `/^-?\d+(\.\d+)?$/`. No result contains a space, ` `, ` ` or `'`. Exact cases: `400000000` → `400000000`, `1234567.891` → `1234567,891` / `1234567.891`, `0.1 + 0.2` → `0,3` / `0.3`, `1e15` → `1000000000000000`. `NaN` and `Infinity` → `""`. **Wiring**, `FieldChart.test.tsx`: the captured `YAxis.tickFormatter(1234567.5)` is `1234567,5` for `locale="ro"`. The captured `XAxis.tickFormatter("2026-09-22")` is `22.09.2026` (`ro`) / `2026-09-22` (`en`), and `XAxis.dataKey === "date"`. The `Tooltip` `content`, called with `{ active: true, payload: [{ payload: point }] }` and rendered with `renderToStaticMarkup`, contains the formatted date and the formatted `display`. With `active: false`, or with a gap point, it renders nothing (§4.3). |
| AC4 | No `ok` report → no chart. A tracked field with no value on any date → translated `noFieldData` message instead of a chart. | `EtfDetail.test.tsx`: `rows: []` → the existing `noHistory` case, plus no `data-chart-field`, no `chartsHeading`, and the chart mock never called. `fields: []` → no chart. `status: "error"` → no chart. Two fields where one has values and one is `null` on every row → the first section has a container, and the second section has its `<h3>` plus `EtfDetail.noFieldData` and no container. The mock was called once. Both locales, and neither shows the other locale's message. **Pure**: `hasAnyValue([])` is `false`, all-`null` is `false`, and one value is `true`. |
| AC5 | Every user-facing string goes through next-intl, with keys in both catalogues. Parity passes. `ro`/`en` renders show the locale's field labels. | New keys `EtfDetail.chartsHeading` and `EtfDetail.noFieldData`. The tooltip reuses `EtfDetail.dateColumn`, passed as `labels.date` (§4.3). `i18n/messages.test.ts` stays green, unchanged. `EtfDetail.test.tsx` and `page.test.tsx`: in `ro`, `ro.EtfDetail.chartsHeading` and each `labelRo` appear, and `en.EtfDetail.chartsHeading` does not. The reverse holds in `en`. The chart mock received `labels.date === <locale>.EtfDetail.dateColumn`. `FieldChart.tsx` has no hard-coded words. Its only text is `labels.*`, catalogue labels, and formatted dates and numbers. The reviewer checks the source for this. |
| AC6 | `recharts` is in `dependencies` at an exact version, and it is the only new direct runtime dependency. The one allowed exception is a peer that `recharts` declares, named here: **`react-is`, pinned exactly to the installed `react` version (`19.2.8`)**, added only under the §5 R2 condition. A clean `pnpm install --frozen-lockfile` exits 0. `pnpm-workspace.yaml` has no unresolved build-approval entry. | **Automated**, new `test/package-config.test.ts`: (a) `package.json` `dependencies.recharts` matches `/^\d+\.\d+\.\d+$/` (exact, no `^`/`~`). (b) If `dependencies["react-is"]` exists, it equals `dependencies.react`. (c) Every `allowBuilds` entry in `pnpm-workspace.yaml` is literally `true` or `false`. This uses a line regex over the `allowBuilds:` block, with no YAML dependency, and guards the US-008 round 1 failure permanently. **Manual by the implementer** (recorded in HANDOVER): `rm -rf node_modules && pnpm install --frozen-lockfile` exits 0. **Reviewer**: compared with this plan's baseline (`@neondatabase/serverless`, `drizzle-orm`, `next`, `next-intl`, `react`, `react-dom`, `unpdf`), `dependencies` gained only `recharts`, and `react-is` if R2 applied. `devDependencies` is unchanged. `minimumReleaseAgeExclude` is unchanged. |
| AC7 | The chart is a client component with only plain serialisable props (points, labels, locale). It imports no database module. `pnpm build` passes with `DATABASE_URL` unset. | **Boundary**, new `components/FieldChart.boundary.test.ts`, which reads source text with `fs`: `components/FieldChart.tsx`'s first statement is `"use client";`. Neither it nor any module it value-imports (`lib/format/chart.ts`, `lib/format/number.ts`, `lib/format/date.ts`) contains `@/lib/db`, `lib/db/`, `drizzle-orm`, `@neondatabase/serverless`, `lib/ingestion`, `next-intl/server`, or a non-`import type` import of `lib/monitoring/history` or `lib/monitoring/chart-series`. **Serialisable**, `EtfDetail.test.tsx`: every prop object the chart mock received satisfies `JSON.parse(JSON.stringify(props))` deep-equal to `props`, so there are no functions, `Date`s or `undefined`s. Its key set is exactly `["labels", "locale", "points"]`. **Build**: the implementer runs `pnpm build` with `DATABASE_URL` unset and records in HANDOVER that it passes and that `ƒ /etf/[symbol]` is still dynamic. |
| AC8 | Gates | `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. There is also an unmocked smoke test, `components/FieldChart.smoke.test.tsx`: the real `recharts` renders `<FieldChart>` through `renderToStaticMarkup` without throwing (§5 R3). |

**MANUAL-QA (live, user).** These are sprint-04.md steps 6 and 7, chart part. No automated test runs a
browser. SSR does not measure `ResponsiveContainer`, so the drawn SVG is only visible here.
1. Open `/etf/BTBETRETF` on the deployment. Below the history table, a "Grafice" heading is followed by
   one chart per tracked field, in the table's column order and titled like the table's headers:
   "Unități de fond în circulație", then "Valoare unitară a activului net (VUAN)". Each chart draws a
   line with a dot on every stored day.
2. The line breaks on every calendar day that has no row in the table. This happens every week under
   US-012 PRODUCT 2's literal reading. It is not drawn through the gap. An ETF with a single stored
   day shows one dot.
3. Hover the newest point. The tooltip shows "Dată: dd.MM.yyyy" and "<label>: <value>", with a decimal
   comma and no grouping. Both match the newest row of the history table exactly, digit for digit.
   Hover a gap day: no tooltip value.
4. Y-axis ticks: no thousands separator (for example `37470000`, not `37.470.000`), with a decimal comma. X-axis ticks: `dd.MM.yyyy`.
5. Switch to EN. The heading becomes "Charts", with the English labels, ISO dates on the X axis and
   in the tooltip, and a decimal dot.
6. PO judgement (step 7): compare with the chart on the instrument's bvb.ro page and say whether the
   style is close enough. Styling defaults picked here: an auto-scaled Y axis (not from 0), a single
   line colour, and grid lines. All are listed in §6 for the PO.
7. Open DevTools → Console on the detail page. There must be no React hydration error and no Recharts
   error. The "width(0) and height(0)" warning must not repeat after load.

**Codex QA (local, `scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/etf/BTBETRETF` still shows
the translated error state and not a crash. No chart is expected, because there is no data. The
Codex loop can also run `pnpm test` / `pnpm build` and the clean-install proof. It cannot check
the drawn chart.

## 2. Files and boundaries

| File | Change | Boundary |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | **Edit** via `pnpm add --save-exact recharts@<v>` (§5 R1). Possibly `pnpm add --save-exact react-is@19.2.8` (§5 R2). | Only `dependencies` changes. The implementer never edits the lockfile by hand. |
| `pnpm-workspace.yaml` | **Edit only if** `pnpm add` asks for build approval. In that case the entry is set explicitly to `false` (or `true` only if the build needs it, justified in HANDOVER). No `minimumReleaseAgeExclude` entry. | — |
| `lib/monitoring/chart-series.ts` | **New.** `export type ChartPoint = { date: string; value: number \| null; display: string \| null }`. `buildChartSeries(rows: readonly HistoryRow[], fieldKey: string): ChartPoint[]`. `hasAnyValue(points: readonly ChartPoint[]): boolean`. | Pure. Its **only** import is `import type { HistoryRow } from "./history"`, a type-only import, erased at compile time, so no DB code is reachable. No `Date` in local time (§4.1). No formatting. |
| `lib/monitoring/chart-series.test.ts` | **New.** AC2 pure cases (a)–(g), plus `hasAnyValue` (AC4) | — |
| `lib/monitoring/chart-series.pglite.test.ts` | **New.** AC2 `parse_error` cases, and AC1's end-to-end untracked-field case | Helpers (`insertEtf`, `trackField`, `ok`, `parseError`) are copied locally from `history.pglite.test.ts`, which is the established pattern. |
| `lib/format/chart.ts` | **New.** `formatAxisTick(n: number, locale: Locale): string` and `formatTooltip(point: ChartPoint, locale: Locale): { date: string; value: string } \| null` | Pure. Value imports are only `formatNumber` and `formatReportDate`. `import type` for `Locale` and `ChartPoint`. Safe for the client bundle. |
| `lib/format/chart.test.ts` | **New.** AC3 pure cases | — |
| `components/FieldChart.tsx` | **New**, `"use client"`. `FieldChart({ points, locale, labels: { series, date } })` renders `ResponsiveContainer` (100% × 100%) › `LineChart data={points}` › `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Line`. Also exports `ChartTooltipContent`. | Receives only plain props. Imports `recharts`, `lib/format/chart.ts`, and types. Never imports `next-intl`: labels arrive already translated, and the locale arrives as a prop (story Task 3). It never reads a database or `process.env`. |
| `components/FieldChart.test.tsx` | **New.** AC2 line props, AC3 wiring, and tooltip rendering, with `vi.mock("recharts")` | — |
| `components/FieldChart.smoke.test.tsx` | **New.** Real `recharts`, no mock (separate file, because `vi.mock` is hoisted per file) | — |
| `components/FieldChart.boundary.test.ts` | **New.** AC7 source scan | — |
| `components/EtfDetail.tsx` | **Edit.** After `<HistoryTable>`, only in the "fields and rows" branch, add the charts section (§4.2). Adds `useLocale()`. | Still a server-compatible, synchronous, presentational component, with no `"use client"`. It builds the series (server side) and passes plain data down. The existing precedence (error → heading → noTrackedFields → noHistory → content) is unchanged. |
| `components/EtfDetail.test.tsx` | **Edit.** Add `vi.mock("./FieldChart", …)` capturing props, plus AC1/AC4/AC5/AC7 cases. **No existing assertion changes.** | — |
| `app/etf/[symbol]/page.test.tsx` | **Edit.** Add `vi.mock("@/components/FieldChart", …)`, plus one `ro` and one `en` case with two fields (story Task 7). **No existing assertion changes.** | — |
| `test/package-config.test.ts` | **New.** AC6 (a)–(c) | Reads `package.json` / `pnpm-workspace.yaml` with `fs`. No network. |
| `messages/ro.json`, `messages/en.json` | **Edit.** `EtfDetail.chartsHeading`: "Grafice" / "Charts". `EtfDetail.noFieldData`: "Nu există date pentru acest câmp." / "No data for this field." | The PO confirms the Romanian copy at the demo (US-004 precedent). |

No change to `lib/monitoring/history.ts`, `app/etf/[symbol]/page.tsx`, `HistoryTable`, `HomeTable`,
`app/layout.tsx`, `vitest.config.ts` (unless R3 forces an `inline` entry, see there), the schema or
the migrations.

## 3. Data model
None. Read-only. No schema change and no migration (story Out of scope, sprint DoD).

## 4. Design

### 4.1 Series builder (`lib/monitoring/chart-series.ts`)
```ts
const DAY_MS = 86_400_000;
function utcDay(iso: string): number {           // "YYYY-MM-DD" → UTC midnight ms; throws if malformed
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  if (!Number.isFinite(t) || isoOf(t) !== iso) throw new Error(`invalid report date: ${iso}`);
  return t;
}
function isoOf(t: number): string { /* getUTCFullYear/Month/Date, zero-padded */ }

export function buildChartSeries(rows, fieldKey): ChartPoint[] {
  if (rows.length === 0) return [];
  const byDate = new Map(rows.map(r => [r.reportDate, r.values[fieldKey] ?? null]));
  const days = [...byDate.keys()].map(utcDay).sort((a, b) => a - b);
  const points: ChartPoint[] = [];
  for (let t = days[0]; t <= days[days.length - 1]; t += DAY_MS) {
    const date = isoOf(t);
    const display = byDate.get(date) ?? null;          // absent date → null: never carried forward
    const value = display === null ? null : Number(display);
    points.push(Number.isFinite(value) ? { date, value, display } : { date, value: null, display: null });
  }
  return points;
}
export const hasAnyValue = (points) => points.some(p => p.value !== null);
```
- UTC-only arithmetic, so the result does not depend on time zone or DST (AC2 e/f). The
  `isoOf(t) === iso` round-trip rejects `2026-02-30`-style rollovers, and the loop is bounded, because a
  malformed date throws before the loop starts (AC2 g).
- `value` is only the plotting position. `display` is the stored string, passed through
  byte for byte (story Notes). A non-finite `Number(display)` cannot happen for a Postgres `numeric`
  column. If it did, both fields become `null`, so the point is not plotted and not shown, and no
  value is guessed.
- It sorts itself and does not rely on the read model's newest-first order.

### 4.2 `EtfDetail` charts section
Rendered only where `<HistoryTable>` is rendered, so fields ≥ 1 and rows ≥ 1 (AC4):
```tsx
<section aria-labelledby="etf-charts-heading">
  <h2 id="etf-charts-heading">{t("chartsHeading")}</h2>
  {fields.map((field) => {
    const label = locale === "ro" ? field.labelRo : field.labelEn;
    const points = buildChartSeries(rows, field.fieldKey);
    return (
      <section key={field.fieldKey} data-chart-field={field.fieldKey}>
        <h3>{label}</h3>
        {hasAnyValue(points) ? (
          <div data-chart-container className="h-64 w-full">
            <FieldChart points={points} locale={locale} labels={{ series: label, date: t("dateColumn") }} />
          </div>
        ) : (
          <p>{t("noFieldData")}</p>
        )}
      </section>
    );
  })}
</section>
```
The explicit-height container is server markup, so `ResponsiveContainer` has a measured parent
(story Notes). The section, heading and container can be asserted without Recharts' SVG.

### 4.3 `FieldChart` (client)
- `<ResponsiveContainer width="100%" height="100%">`. If the installed version supports
  `initialDimension`, pass `{ width: 600, height: 256 }` to reduce the SSR "width(0)" warning
  (MANUAL-QA 7). This is optional. No AC depends on it.
- `<LineChart data={points} accessibilityLayer>`, with `<CartesianGrid strokeDasharray="3 3" />`.
- `<XAxis dataKey="date" tickFormatter={(d: string) => formatReportDate(d, locale)} minTickGap={16} />`.
  One point per calendar day makes a category axis proportional to time.
- `<YAxis domain={["auto", "auto"]} tickFormatter={(n: number) => formatAxisTick(n, locale)} width={88} />`.
  The auto domain avoids flattening VUAN (~11) against 0. This is a styling default for the PO (§6).
- `<Tooltip content={(p) => <ChartTooltipContent active={p.active} payload={p.payload} locale={locale} labels={labels} />} />`.
- `<Line type="linear" dataKey="value" name={labels.series} connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} stroke="#1d4ed8" />`.
  `linear` rather than `monotone`, so no curve suggests values between days.
- `ChartTooltipContent({ active, payload, locale, labels })` reads `payload?.[0]?.payload as ChartPoint`,
  then `formatTooltip(point, locale)`. It returns `null` when not active or for a gap point (FR4.1
  blank). Otherwise it renders `<div><p>{labels.date}: {date}</p><p>{labels.series}: {value}</p></div>`.
  It gets its own explicit prop type, not Recharts' generic `TooltipProps`, so the test can call it
  directly.

`formatAxisTick(n, locale)` is `Number.isFinite(n) ? formatNumber(new Intl.NumberFormat("en-US",
{ useGrouping: false, maximumFractionDigits: 6 }).format(n), locale) : ""`. The fixed `en-US`
base with no grouping gives an ASCII `-`/digits/`.` string. `formatNumber` (DEC-007) then applies the
locale's decimal mark, so ticks and table share one decimal-mark rule and do not depend on ICU
`ro-RO` data. Ticks are rounded because they are axis graduations, not stored values. Exactness is
required only of the tooltip, which uses `display`.

### 4.4 Test mocking pattern
- `FieldChart.test.tsx`: `vi.mock("recharts", () => ({ ResponsiveContainer, LineChart, CartesianGrid,
  XAxis, YAxis, Tooltip, Line }))`. Each stub records its props into a module-level `captured` object.
  Container stubs render `<div>{children}</div>`, and leaf stubs return `null`. Rendering
  `<FieldChart>` with `renderToStaticMarkup` fills `captured`. The tests then call the captured
  formatter and `content` functions directly.
- `EtfDetail.test.tsx` / `page.test.tsx`: `vi.mock("./FieldChart")` / `vi.mock("@/components/FieldChart")`
  with `FieldChart: (props) => { calls.push(props); return <div data-mock-chart={props.labels.series} />; }`.
  Both specifiers resolve to the same module id, so the page's transitive import is mocked too.
  Reset `calls` in `beforeEach`.
- `FieldChart.smoke.test.tsx`: no mocks. It proves the real package imports and renders under Node,
  React 19 and vitest.

## 5. Risks
- **R1: Version and release age.** Use the newest **3.x** `recharts` that pnpm's minimum-release-age
  policy accepts: `pnpm add --save-exact recharts@^3`. If pnpm refuses the newest one, pin the next
  older 3.x. Do not add a `minimumReleaseAgeExclude` entry (tech-lead review). 3.x is the maintained
  line, and its peer range includes React 19. Record the exact version and `pnpm why recharts` in
  HANDOVER.
- **R2: `react-is` and React 19.** Recharts declares `react-is` as a peer. pnpm auto-installs peers,
  but it can satisfy the range with the `react-is@16.13.1` already in the graph (it is in
  `node_modules/.pnpm` today, via another package). `react-is` 16/18 does not recognise React 19's
  element symbol, and this is the known cause of Recharts rendering an empty chart on React 19.
  **Condition:** after R1, check in `pnpm-lock.yaml` that the `recharts@<v>` snapshot resolves
  `react-is` to `19.x`. If it does, add nothing. If it resolves to anything else, run
  `pnpm add --save-exact react-is@19.2.8`, the same version as `react`. This is AC6's named
  exception. Re-check the snapshot, and record which branch applied in HANDOVER.
- **R3: Recharts under vitest/SSR.** Recharts 3 ships CJS (`main`) and ESM. If the smoke test fails
  on module format, add `"recharts"` to `vitest.config.ts` `server.deps.inline`, as for `next-intl`,
  and record it. SSR does not measure `ResponsiveContainer`, so the smoke test asserts only "renders
  without throwing and returns a string". It does not assert that `<svg` is present. The drawn chart
  is MANUAL-QA. This gap is accepted: the Line/Axis/Tooltip props are fully asserted through the
  mock, and the real-package render is smoke-tested.
- **R4: Install scripts.** Recharts' dependency tree (redux toolkit, immer, d3-derived
  `victory-vendor`, and similar) has no known install scripts. If `pnpm add` prompts anyway,
  resolve the entry explicitly in `pnpm-workspace.yaml` (§2). Always run the clean-install proof:
  US-008 passed locally against a populated `node_modules` and failed from an empty one.
- **R5: Client bundle leakage.** One accidental value import of `lib/monitoring/history.ts` from the
  client would pull `drizzle-orm` and the Neon driver into the browser bundle. `chart-series.ts`
  imports `HistoryRow` with `import type`. `FieldChart` imports `ChartPoint` with `import type`.
  The AC7 boundary test enforces both.
- **R6: US-018 test churn.** `EtfDetail.test.tsx` and `page.test.tsx` fixtures have rows and fields, so
  they now render charts. The FieldChart mock keeps them independent of Recharts. No existing
  assertion is loosened. None is affected: they check `<table>`, `<h1>` and messages, and none
  counts elements that the charts add. The reviewer checks this in the diff.
- **R7: Long histories.** One point per calendar day. After years that is a few thousand points,
  which Recharts handles. The X ticks thin out through `minTickGap`. There is no range selector
  (decision 2 C is a possible follow-up).
- Smallest design: one pure builder, two pure format functions, one client chart component, and one
  section in the existing `EtfDetail`. There is no chart abstraction or config registry. Every chart is the
  same line chart, and nothing in the requirements asks for chart types.

## 6. Decisions needed
None new. Sprint-04.md #12 (gaps and range, PRODUCT, non-blocking): option A is implemented, as the
story says. For the PO's eye at the demo (styling and copy, not decisions): "Grafice" / "Charts" and
"Nu există date pentru acest câmp." / "No data for this field."; an auto-scaled Y axis rather than
one starting from 0; no tooltip on a gap day; one line colour, dots on every point, and dashed grid
lines. Each is a single prop or one message in §4.2/§4.3 if the PO wants it closer to bvb.ro.
