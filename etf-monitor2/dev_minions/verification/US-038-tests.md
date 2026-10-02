# US-038 independent test verdict — Round 1

Date: 2026-10-02  
Verdict: **PASS**

Independent test run for US-038 acceptance criteria AC1–AC8. No source, test,
status, or HANDOVER files were edited. No git command, secret value/file access,
migration, or deployment was attempted.

## Commands and results

All commands ran from `/mnt/c/_mystaff/myG/trade/etf-monitor2` through WSL
`bash -lc`, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `GEMINI_API_KEY`,
and `GROQ_API_KEY` unset before each command.

| Command | Exit | Result |
|---|---:|---|
| `pnpm exec vitest run components/chart-type.test.ts components/FieldChart.test.tsx components/FieldChart.palette.test.tsx components/FieldChart.smoke.test.tsx components/FieldChart.boundary.test.ts components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx i18n/messages.test.ts lib/monitoring/chart-series.test.ts` | 0 | 9 files, 74 tests passed |
| `pnpm typecheck` | 0 | `tsc --noEmit` passed |
| `pnpm lint` | 0 | 0 errors, 9 warnings (in unrelated existing files) |
| `pnpm test` — first full run | 1 | 193 files and 1,963 tests passed; 4 tests timed out in `lib/db/seed.pglite.test.ts`, `lib/config/home-display.pglite.test.ts`, `lib/ai/chat.pglite.test.ts`, and `lib/config/tracked-fields.pglite.test.ts` |
| `pnpm exec vitest run --fileParallelism=false lib/ai/chat.pglite.test.ts lib/config/home-display.pglite.test.ts lib/config/tracked-fields.pglite.test.ts lib/db/seed.pglite.test.ts` | 0 | All 4 timeout files passed serially: 48 tests |
| `pnpm test` — final full retry | 0 | 197 files, 1,967 tests passed |
| `pnpm build` | 0 | Offline production build passed; migration step skipped because this was not a production build; all 12 routes generated |

Before the final explicit retry, an initial invocation using `pnpm test -- <file
list>` also ran the full suite rather than the intended selectors and passed
197 files / 1,967 tests. The correctly targeted focused command above was run
separately. The first explicit full-suite timeout run is retained here for
transparency; its four failures passed serially, and the final full-suite retry
passed.

## Acceptance criteria

| AC | Result | Independent evidence |
|---|---|---|
| AC1 — Per-chart selector, default, identity | **MET** | `components/EtfDetail.chart-types.test.tsx` renders two tracked chart sections with independent controls, four ordered translated options, and default `line`. `components/EtfDetail.test.tsx` checks symbol/field identity and localized labels passed to each chart. `components/chart-type.test.ts` proves storage keys isolate both symbol and field identities. |
| AC2 — Correct chart variant and existing axes/tooltip | **MET** | `components/FieldChart.test.tsx` checks line, line-with-dots, columns, and area series selection, including `dataKey="value"`, gaps, axes and tooltip formatters. The same file verifies the tooltip passed to Recharts still renders localized date and stored display value (`FC-TT1`–`FC-TT4`). |
| AC3 — Browser-local remembered choice, no server path | **MET** | `components/chart-type.test.ts` checks valid/invalid/missing values, read/write exceptions, and independent identities. The source-boundary assertions in `components/FieldChart.test.tsx` check the chart-type module and `FieldChart` have no fetch/server/database/config path. Server rendering in the chart tests starts with the line default. |
| AC4 — Single point is prominent and correctly labelled | **MET** | `components/chart-type.test.ts` checks value-count semantics. `components/FieldChart.test.tsx` exercises each chart type with a one-point series and a longer series with one value, asserting radius 6, token fill, and `11,171` / `11.171` from the stored display string for RO / EN. |
| AC5 — Missing days remain gaps | **MET** | `components/FieldChart.test.tsx` verifies line/line-with-dots/area use `connectNulls={false}`, the columns path retains null-valued points in the data passed to Recharts, and the source series is passed unchanged. `lib/monitoring/chart-series.test.ts` passes all 13 existing series/gap tests. |
| AC6 — Token-only palette and tooltip | **MET** | `components/FieldChart.palette.test.tsx` passes all 4 checks for token stroke, rendered dot, axes/grid and tooltip surface, and source colour-literal scan. `components/FieldChart.test.tsx` checks token use for each chart variant and the formatted tooltip callback. |
| AC7 — Romanian and English labels | **MET** | `components/EtfDetail.chart-types.test.tsx` and `components/FieldChart.test.tsx` verify both locales render their own selector labels and not the other locale's labels. `i18n/messages.test.ts` passes catalogue key parity and non-empty leaf checks. |
| AC8 — Deliberate markup changes and required gates | **MET** | The permitted chart markup changes are documented in the US-038 section of `dev_minions/HANDOVER.md`. Focused tests, typecheck, lint, final full test suite and offline build all pass. Existing tooltip, chart-section/container, no-data, and gap behavior assertions remain exercised by the focused tests. `recharts` is already present as a dependency; no dependency installation was performed. |

## Manual QA

**MANUAL-QA:** visual inspection of chart-type switching and a single-point chart
on a populated live ETF detail page. Automated Recharts/component tests do not
substitute for the populated live chart check; this requires the deployed
database-backed page.

## Denied or attempted commands

None.
