# US-038 independent review — Round 1

**Verdict: FAIL (AC8 full-suite gate did not pass in this review run).**

No Critical findings. One Warning is recorded below; it concerns unrelated PGlite
timeouts, not a defect found in the US-038 implementation.

## Acceptance criteria

| AC | Result | Independent evidence |
|---|---|---|
| AC1 | MET | `components/FieldChart.tsx:156-184` uses a controlled selector with the default `"line"` and four ordered `CHART_TYPES`; `components/EtfDetail.tsx:47-70` passes each chart its symbol, field key and translated labels. Server-render tests assert two independently labelled selectors and default line (`components/EtfDetail.chart-types.test.tsx:19-43`); the RO/EN two-field identity/label test is in `components/EtfDetail.test.tsx:206-229`. |
| AC2 | MET | `components/FieldChart.tsx:78-154` selects the `Line`, `Bar` or `Area` child within the single `ComposedChart`, applies the isolated-point rule to line dots, and keeps `connectNulls={false}` for line and area. Tests exercise all four variants and their data keys (`components/FieldChart.test.tsx:173-197`). Axes and tooltip remain in the shared chart body (`components/FieldChart.tsx:184-202`). |
| AC3 | MET | Storage keys encode the symbol/field tuple; invalid or throwing storage falls back to line / is ignored (`components/chart-type.ts:9-31`). The component supplies a line-only server snapshot and reads storage through `useSyncExternalStore` (`components/FieldChart.tsx:69-76,156-167`), so the server and hydration snapshot do not read `window.localStorage`; persisted state is read after hydration. Pure tests verify same-identity round-trip, separate identities, and throwing storage (`components/chart-type.test.ts:20-44`). Source-scan tests find no server write path (`components/FieldChart.test.tsx:227-234`). |
| AC4 | MET | `isSingleValue` counts non-null values rather than calendar positions (`components/chart-type.ts:35-37`). The line/area dot and column label callbacks use `display` via `formatNumber`, with radius 6 versus the normal radius 3 (`components/FieldChart.tsx:86-114`). The test invokes all four render paths for both one-position and gapped single-value series in RO and EN and asserts the stored formatted text and large token-colored point (`components/FieldChart.test.tsx:199-225`). A populated deployment visual check remains MANUAL-QA. |
| AC5 | MET | `buildChartSeries` preserves gap positions as `{ value: null, display: null }` (`lib/monitoring/chart-series.ts:5-7,59-61`). The composed chart receives the original `points` array (`components/FieldChart.tsx:184`); all line/area variants disable null connection, while columns use the same `value` data key and no line/area (`components/FieldChart.tsx:117-139`; tests `components/FieldChart.test.tsx:173-197`). |
| AC6 | MET | Series, area fill, dots and single-value labels use `var(--chart-1)`; grid/axes and tooltip use the existing palette tokens (`components/FieldChart.tsx:86-151,184-202`). Tests cover each variant's series settings and token-colored single point (`components/FieldChart.test.tsx:173-225`), axes/tooltip tokens and source color-literal absence (`components/FieldChart.palette.test.tsx:68-103`). |
| AC7 | MET | The selector name and four chart labels are present in both message catalogues (`messages/en.json:40-47`, `messages/ro.json:40-47`), are passed pre-translated by `EtfDetail` (`components/EtfDetail.tsx:65-70`), and are asserted in both locales without cross-locale labels (`components/FieldChart.test.tsx:149-170`, `components/EtfDetail.test.tsx:206-229`). The key-parity test passed. |
| AC8 | NOT MET | The examined assertions retain the chart wrapper/field hooks, no-data branch and the original tooltip behavior; FC-TT1–FC-TT4 still assert localized dates/values, use of stored display text, and inactive/gap behavior (`components/FieldChart.test.tsx:260-315`). The component uses the existing Recharts 3.10.1 dependency (`package.json`). Typecheck, lint (0 errors; 9 warnings), and offline build passed. However, the independent full `pnpm test` run failed 2 of 1,967 tests on timeout; the isolated retry still timed out in `lib/db/seed.pglite.test.ts` (SD-1, SD-2). Therefore the full-suite pass required by AC8 is not established in this review. |

## Findings

### Warning W1 — full-suite timeouts outside US-038

The full regression run reported `197` files, `1965` tests passed and `2` failed:
`lib/db/seed.pglite.test.ts` SD-1 timed out at 20 seconds and
`app/home-display-actions.pglite.test.ts` HD-A1 timed out in its 30-second setup hook.
An isolated retry passed `app/home-display-actions.pglite.test.ts` (8/8), but
`lib/db/seed.pglite.test.ts` still timed out in SD-1 and SD-2. These files are not
part of the US-038 changed-file list; no causal connection to US-038 was found.
The focused US-038/i18n suite passed 7 files / 58 tests. W1 is why AC8 is NOT MET
for this independent run; it does not identify a US-038 source defect.

## Verification commands and results

Commands were run from `/mnt/c/_mystaff/myG/trade/etf-monitor2` using WSL `bash -lc`,
with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `GEMINI_API_KEY` and `GROQ_API_KEY`
unset for every check.

- `pnpm exec vitest run components/chart-type.test.ts components/FieldChart.test.tsx components/FieldChart.palette.test.tsx components/FieldChart.smoke.test.tsx components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx i18n/messages.test.ts` — exit 0; 7 files / 58 tests passed.
- `pnpm typecheck` — exit 0.
- `pnpm lint` — exit 0; 0 errors, 9 warnings.
- `pnpm test` — exit 1; 195/197 files passed, 1965/1967 tests passed; failures and isolated retry detailed under W1.
- `pnpm exec vitest run lib/db/seed.pglite.test.ts app/home-display-actions.pglite.test.ts` — exit 1; 1/2 files passed, 13/15 tests passed; seed SD-1 and SD-2 timed out.
- `pnpm build` — exit 0; migration step skipped because this was not a production build; all 12 routes built.

## Command hygiene

No git, migration, deployment, or secret-file command was run. An initial grouped
gate-shell invocation unexpectedly emitted an ambient environment listing instead
of gate output; it was not counted as evidence, and subsequent checks used explicit
`env -u` commands. No environment values are reproduced here.
