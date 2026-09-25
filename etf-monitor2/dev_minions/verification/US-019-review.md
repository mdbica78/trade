# US-019 — Independent review

## Round 1 — 2026-09-25

Verdict: PASS

Reviewer scope: read `AGENTS.md`, `dev_minions/backlog/stories/US-019.md`,
`dev_minions/verification/US-019-plan.md`, `dev_minions/HANDOVER.md` (current "Files changed"
list), and every file listed there in full. Ran `pnpm typecheck` and `pnpm lint` only (per this
review's tool scope); did not run `pnpm test` / `pnpm build` — that is the `story-tester`'s job,
run independently in parallel. Grepped the whole tree for the story's new symbols
(`buildChartSeries`, `FieldChart`, `chart-series`, `formatAxisTick`, `formatTooltip`,
`chartsHeading`, `noFieldData`) to confirm nothing outside the declared "Files changed" list was
touched — confirmed, the grep hit set is exactly that list. Did not run git, per instructions.

### Acceptance criteria

- **AC1 (one chart per tracked field, display_order/field_key order, catalogue label, untracked
  field excluded)** — MET. `components/EtfDetail.tsx:41-56` renders one `<section
  data-chart-field>` per entry of `history.fields` (already ordered by `display_order,
  field_key` in `lib/monitoring/history.ts:39`, unchanged from US-018 and not re-sorted here),
  titled `<h3>{label}</h3>` with `locale === "ro" ? field.labelRo : field.labelEn`. Proven by
  `components/EtfDetail.test.tsx:107-124` (three fields in given order, `net_asset` stored but
  untracked never gets a `data-chart-field` and the chart mock is never called for it) and
  end-to-end on PGlite by `lib/monitoring/chart-series.pglite.test.ts:75-87` (an untracked stored
  field never reaches `history.fields`, so no series is ever built for it — `999999` never
  appears in `JSON.stringify`). Also proven at the page level,
  `app/etf/[symbol]/page.test.tsx:132-157`, in both `ro` and `en`.
- **AC2 (ascending, one point per calendar day, gaps null/null, `parse_error` excluded, no
  interpolation, `connectNulls={false}`, dot on every point)** — MET.
  `lib/monitoring/chart-series.ts:45-64` implements the UTC-day walk exactly as specified;
  `lib/monitoring/chart-series.test.ts` covers ascending order regardless of input order, the
  09-21/09-23 gap giving `{value:null,display:null}` on 09-22, no carry-forward, DST/year
  boundaries, TZ-independence (`America/Los_Angeles`, `Pacific/Kiritimati`), and the malformed-date
  throw. `chart-series.pglite.test.ts:51-73` proves the `parse_error`-contributes-nothing case
  through the real `createEtfHistoryLoader` read model (a `parse_error` row with a stored
  `"999"` never appears in the series; a `parse_error` filed *after* the newest `ok` report does
  not extend the series). `components/FieldChart.tsx:71` sets `connectNulls={false}` and
  `dot={{ r: 3 }}` (not `false`), asserted in `components/FieldChart.test.tsx:68-75`.
- **AC3 (tooltip = formatted date + `formatNumber(display)`, never `value`; Y-tick no grouping;
  pure + unit-tested)** — MET. `lib/format/chart.ts:26-31` `formatTooltip` reads `point.display`
  only; `lib/format/chart.test.ts:5-14` uses a deliberately wrong `value: 1` to prove the text
  comes from `display`, not `value`, exactly as the plan's Notes required, and checks trailing
  zeros are preserved (`"11.1700"` → `"11,1700"`). `formatAxisTick` (`chart.ts:13-19`) is proven
  grouping-free in both locales for a wide value range including `1e15` and `0.1+0.2`, with exact
  expected strings. Wiring is checked end to end in `components/FieldChart.test.tsx:90-94` (the
  captured `YAxis.tickFormatter`) and `:77-88` (captured `XAxis.tickFormatter`), and
  `ChartTooltipContent` rendering in `:97-119`.
- **AC4 (no `ok` report → no chart; field with no value anywhere → translated message)** — MET.
  `EtfDetail.tsx:32-36` keeps the existing precedence (no chart section is reached unless
  `fields.length > 0 && rows.length > 0`); within the section, `hasAnyValue(points)` (`chart-
  series.ts:67-69`) gates the chart vs. the `noFieldData` message (`EtfDetail.tsx:47-53`).
  `EtfDetail.test.tsx:126-165` covers all four cases (no rows, no fields, status error, one field
  with values / one field entirely null) in both locales, checking the chart mock call count each
  time.
- **AC5 (every string through next-intl, ro+en keys, key parity, locale labels shown)** — MET.
  New keys `EtfDetail.chartsHeading` / `EtfDetail.noFieldData` present in both
  `messages/en.json:23-24` and `messages/ro.json:23-24`, structurally parallel with the rest of
  the (unchanged) `EtfDetail` block, so `i18n/messages.test.ts`'s parity check is unaffected.
  `FieldChart.tsx` contains no hard-coded words — its only text is `labels.date`, `labels.series`
  (both passed in already translated) and the output of `formatReportDate`/`formatNumber`;
  confirmed by reading the full source. Render tests assert the locale's label appears and the
  other locale's does not (`EtfDetail.test.tsx:118-124`, `page.test.tsx:143-156`).
- **AC6 (recharts exact version, only new runtime dependency, named peer exception, clean
  install, no unresolved `allowBuilds` entry)** — MET. `package.json:25` `"recharts": "3.10.1"`
  (exact, no range operator). `dependencies` also gained `"react-is": "19.2.8"` (`package.json:24`),
  exactly matching `react`'s `19.2.8` (`package.json:22`) — the one exception AC6 itself names.
  `test/package-config.test.ts` automates both the exact-version check and the `pnpm-
  workspace.yaml` `allowBuilds` check (all five entries are literal `true`/`false`,
  `pnpm-workspace.yaml:2-6`); `minimumReleaseAgeExclude` is untouched (still only the `next`-
  related entries from before). Diffing the dependency block against the pre-story baseline
  named in the plan (`@neondatabase/serverless`, `drizzle-orm`, `next`, `next-intl`, `react`,
  `react-dom`, `unpdf`) confirms exactly `recharts` + `react-is` were added, nothing else;
  `devDependencies` is unchanged. The clean-install proof and `pnpm why recharts` are recorded
  only in HANDOVER prose, not independently re-run by this review — see the Notes below for a
  discrepancy in that prose worth fixing.
- **AC7 (client-only component, plain serialisable props, no DB import, `pnpm build` with
  `DATABASE_URL` unset)** — MET. `components/FieldChart.tsx:1` starts with `"use client";`;
  its only value imports are `recharts`, `@/lib/format/chart`, `@/lib/format/date`, plus
  `import type` for `Locale` and `ChartPoint`. `components/FieldChart.boundary.test.ts` scans the
  source text of `FieldChart.tsx` and its value-imported modules for any of `@/lib/db`,
  `lib/db/`, `drizzle-orm`, `@neondatabase/serverless`, `lib/ingestion`, `next-intl/server`, and
  separately asserts `lib/monitoring/history`/`chart-series` are never imported except as
  `import type`. `EtfDetail.test.tsx:167-174` asserts every prop object the mock received
  round-trips through `JSON.parse(JSON.stringify(...))` unchanged, with exactly the keys
  `["labels","locale","points"]`. The `pnpm build` run with `DATABASE_URL` unset is reported in
  HANDOVER, not independently re-run by this review (out of this review's tool scope, expected to
  be covered by the tester and by the immediately-preceding US-018 handover's own build run,
  which this story does not touch `app/etf/[symbol]/page.tsx` or any DB-adjacent file for).
- **AC8 (`typecheck`, `lint`, `test`, `build` all pass)** — `typecheck` and `lint` independently
  re-run here: **MET** (`tsc --noEmit` clean; `eslint` exits 0 with the same 3 pre-existing
  unused-var warnings already logged in earlier rounds, none introduced by this story). `test`
  and `build` are reported green in HANDOVER but not re-run by this review; MET pending the
  tester's independent confirmation (expected, given the review/test split in this project).

### Findings (ordered by severity)

No Critical findings.

1. `dev_minions/HANDOVER.md:17` (Files changed note) — states "pnpm resolved its `react-is` peer
   to `19.2.8` on its own, so no explicit `react-is` dependency was needed (R2's 'add nothing'
   branch)", but `package.json:24` explicitly lists `"react-is": "19.2.8"` as a direct dependency.
   The two statements contradict each other: either the explicit dependency was added (R2's other
   branch) and the prose is wrong, or the prose is right and the dependency shouldn't be there.
   Functionally this is harmless and within what AC6 itself allows (react-is, pinned to react's
   version, is the one named exception) — `test/package-config.test.ts` passes either way — but
   this project has twice already flagged inaccurate self-reporting in verdict/handover prose
   (US-002's reviewer git-command note, US-009's "no git commands were run" note) as worth fixing
   precisely because it undermines the audit trail. **Warning** — fix the HANDOVER prose to match
   the actual `package.json`, and record which R2 branch was actually taken and why.
2. `dev_minions/HANDOVER.md:27` ("Failing / open") — says "791/791 tests incl. the 21 new US-019
   tests". Counting the `it(...)` blocks in the nine new/edited test files under review
   (`chart-series.test.ts` 13, `chart-series.pglite.test.ts` 3, `chart.test.ts` 8,
   `FieldChart.test.tsx` 8, `FieldChart.boundary.test.ts` 3, `FieldChart.smoke.test.tsx` 1,
   `EtfDetail.test.tsx`'s new "US-019 charts" describe 7, `page.test.tsx`'s one new case, and
   `package-config.test.ts` 3) gives 47, not 21, and 744 (US-018's own reported total) + 47 = 791,
   which matches the stated grand total. So the grand total (791) is internally consistent with
   an actual ~47 new tests, but the "21 new" figure itself looks stale — plausibly left over from
   a partial count before the prior session died mid-implement (the same paragraph says the file
   list was rebuilt from `.files-touched.log` after that). **Warning**, non-blocking — doesn't
   change the PASS verdict on AC8's test count, but the tester should confirm the true new-test
   count and the implementer should correct the HANDOVER line.
3. `components/FieldChart.tsx:66` — the `Tooltip content` callback casts `p.payload as unknown as
   { payload: ChartPoint }[]` to bridge Recharts' generic tooltip payload type to
   `ChartTooltipContent`'s own prop type. This is a legitimate way to keep
   `ChartTooltipContent` independently testable (as the plan specifies), not a defect, but it is
   an `unknown` cast at a library boundary worth a one-line comment explaining why it's safe (the
   shape is guaranteed by `LineChart`'s own `data` prop, which this component controls). **Note**,
   non-blocking.

### Scope deviations

None found beyond the one AC6 explicitly authorises (`react-is` as the named peer exception). The
grep-based check for the story's new symbols hit exactly the files listed under HANDOVER's "Files
changed" for US-019 and no others; `app/etf/[symbol]/page.tsx`, `HistoryTable`, `HomeTable`,
`lib/monitoring/history.ts`, `lib/format/number.ts`, `lib/format/date.ts`, `vitest.config.ts`, the
schema and migrations are all confirmed unchanged, matching the plan's explicit "no change to"
list. No existing assertion in `EtfDetail.test.tsx` or `page.test.tsx` was loosened, deleted or
weakened — every pre-existing `it(...)` block is present with its original assertions; only new
`it(...)` blocks were added.

### Not independently re-verified by this review (tool-scope boundary)

- `pnpm test`, `pnpm build` (incl. the `DATABASE_URL`-unset build and the `ƒ /etf/[symbol]`
  dynamic-route check), and the `rm -rf node_modules && pnpm install --frozen-lockfile` clean-
  install proof for AC6 — all reported green in HANDOVER; expected to be independently confirmed
  by `story-tester`.
- The MANUAL-QA items (sprint-04.md steps 6–7: visual comparison with bvb.ro's chart style, live
  hover/tooltip check, Y/X tick formatting on a real render, EN switch, DevTools console check) —
  correctly deferred as `MANUAL-QA`, none of them can be exercised without a browser and a live
  render, consistent with AGENTS.md's rule that criteria genuinely needing a live resource become
  MANUAL-QA steps. No automated criterion depends on these.
