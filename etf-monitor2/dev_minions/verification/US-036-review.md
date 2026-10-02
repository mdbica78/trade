# US-036 — Independent review, round 1

**Verdict: FAIL**

Reviewed the current US-036 implementation and tests independently. Three acceptance criteria
are not fully met because their explicitly required render-test coverage is missing. No
application behavior defect was found in those paths. The responsive/design checks and full
project gates remain for the separate QA/test phase.

## Acceptance criteria

| AC | Status | Independent evidence |
|---|---|---|
| AC1 | **NOT MET** | `components/HomeTable.tsx` builds the detail URL with `encodeURIComponent`, and the row/link CSS implements the stretched link. `components/HomeTable.test.tsx` checks the two ordinary symbols and one detail link per row, but has no symbol requiring encoding, although AC1 explicitly requires that render case. See warning W1. |
| AC2 | **NOT MET** | The PDF anchor uses the supplied `latestPdfUrl`, correct `target`/`rel`, a translated accessible name, and CSS positioning above the stretched row link. The render test checks those attributes and the accessible name only with the English catalogue; AC2 requires render coverage in both RO and EN. See warning W2. |
| AC3 | **MET** | `buildActiveEtfsStatement` selects `etfs.name`; both unsaved and saved-view PGlite cases assert names from the ETF rows in `lib/monitoring/home-display.pglite.test.ts`. `HomeTable` renders the name below the symbol and retains the no-adapter marker and hook; `HomeTable.test.tsx` covers both. |
| AC4 | **MET** | `buildPreviousAvailableValuesStatement` restricts candidates to `ok` reports with non-null values, strictly earlier than the latest `ok` report, and selects the newest candidate per ETF/field. PGlite cases cover Friday-to-Monday, a `parse_error`, distinct per-field predecessor dates, no predecessor/current value, zero previous value, and month/year/leap-year boundaries in `lib/monitoring/home-delta.pglite.test.ts`. |
| AC5 | **MET** | `computeCellDelta` rejects non-canonical values and calls the existing exact `computeDelta`; it includes the selected previous date and has no calendar-day comparison. `home-delta.test.ts` guards that boundary; `delta.test.ts` covers exact arithmetic, rounding and the zero divisor; PGlite and component tests cover null percentage handling. |
| AC6 | **MET** | `HomeTable` derives tone and arrow from the canonical absolute string, renders arrow/absolute/percent in that order, includes translated screen-reader text and a localized previous-date title, and omits disabled parts or an empty change line. `HomeTable.test.tsx` covers gain, loss, flat, arrow-only, switches, null percentage, null delta and both locales for the title. |
| AC7 | **MET** | `HomeTable` continues to use `formatNumber`, `formatDeltaAbsolute`, `formatDeltaPercent` and `formatReportDate`; render assertions cover both locale decimal marks and delta formatting. `lib/format/number.test.ts` covers large values without grouping separators in both locales. The stylesheet test checks right alignment and tabular digits. |
| AC8 | **MANUAL-QA** | The stylesheet and `app/globals.home-table.test.ts` establish no-wrap numeric/date cells, the scroll wrapper and table minimum width. I did not independently observe the rendered page at 390 px, so the required check for inner scrolling, no page overflow and unwrapped cells remains manual. |
| AC9 | **MANUAL-QA** | Current tests retain assertions for value text, the extraction-unavailable marker, PDF URL/target/rel, empty/error states and the replacement symbol-to-detail link. Without a baseline diff (git is prohibited), I cannot independently verify the criterion that no other assertions were changed or removed. |
| AC10 | **MANUAL-QA** | I opened all four design-reference PNGs and inspected the table implementation and CSS, but no current rendered capture was available for comparison. I therefore make no MATCH/DEVIATION claim; compare the harness/live captures with the references during visual QA. |
| AC11 | **MANUAL-QA** | The harness imports the shared `HomePageBody`, uses a committed fixture with four ETFs, two columns, gains/losses/flat/blank/no-PDF/no-adapter cases, copies every built stylesheet, and emits RO/EN × light/dark documents. Its test asserts these outputs and the import-boundary test scans application files. However, the QA checklist is not present yet and I could not execute the tests here; confirm the checklist command and run the harness after build in the QA phase. |
| AC12 | **NOT MET** | Both catalogues contain the PDF label, three arrow descriptions and previous-date title, and the shared key-parity test covers catalogue key parity. The component tests render the PDF accessible name and arrow descriptions only in English; only the previous-date title is explicitly rendered in both languages. This falls short of AC12's RO/EN render-test requirement for the new strings. See warning W2. |
| AC13 | **MANUAL-QA** | I did not obtain independent evidence for typecheck, lint, the full test suite or production build. The test runner reported “No tests found in the files”; a direct PowerShell `pnpm exec vitest ...` attempt could not start because `pnpm` was not recognized. The independent tester must run the project gates on the final source. |

## Findings

### Critical findings

None.

### Warning findings

- **W1 — AC1 render coverage is incomplete.** The implementation uses `encodeURIComponent`, but
  the render cases only use ordinary symbols. Add a symbol needing URI encoding and assert its
  rendered detail URL; until then AC1 is NOT MET.
- **W2 — Romanian accessibility strings are not exercised by render tests.** The PDF accessible
  name and arrow screen-reader descriptions are only asserted with the English catalogue.
  Add RO/EN render assertions that each localized string appears in its locale and the other
  locale's corresponding text does not; until then AC2 and AC12 are NOT MET.

**Why FAIL:** AC1, AC2 and AC12 have explicit render-test requirements that the current tests do
not satisfy. The implementation appears to use the correct encoding and translation mechanisms,
but source inspection alone does not satisfy the stated test criteria.

## Files inspected

- `AGENTS.md`
- `dev_minions/HANDOVER.md`
- `dev_minions/.checkpoint.md`
- `dev_minions/status.md`
- `dev_minions/backlog/sprints/sprint-09.md`
- `dev_minions/verification/DEMO-20260928-1300.md`
- `dev_minions/backlog/stories/US-036.md`
- `dev_minions/verification/US-036-plan.md`
- `lib/monitoring/home.ts`
- `lib/monitoring/home-delta.pglite.test.ts`
- `lib/monitoring/home-delta.test.ts`
- `lib/monitoring/home.pglite.test.ts`
- `lib/monitoring/home-display.pglite.test.ts`
- `lib/monitoring/delta.ts`
- `lib/monitoring/delta.test.ts`
- `lib/format/number.test.ts`
- `components/HomeTable.tsx`
- `components/HomeTable.test.tsx`
- `components/HomePageBody.tsx`
- `components/HomeTable.hooks.test.tsx`
- `app/page.tsx`
- `app/globals.css`
- `app/globals.home-table.test.ts`
- `scripts/qa/render-home.tsx`
- `scripts/qa/render-home-fixture.ts`
- `scripts/qa/render-home.test.tsx`
- `scripts/qa/boundaries.test.ts`
- `messages/en.json`
- `messages/ro.json`
- `i18n/messages.test.ts`
- `mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`,
  `mockup-home-phone.png` under `dev_minions/backlog/home-design/`

**Denied or attempted prohibited commands:** none.

## Round 2 verdict

**Verdict: PASS**

Rechecked the round-1 findings against the current render assertions in
`components/HomeTable.test.tsx`. The additions close both findings; no application code
changed for these fixes.

| AC | Round 2 status | Independent evidence |
|---|---|---|
| AC1 | **MET** | The new render case supplies symbol `A/B` and asserts the detail URL is `/etf/A%2FB`; it also asserts there is exactly one stretched-row-link hook. This exercises the reserved-character encoding through rendered markup rather than relying only on source inspection. |
| AC2 | **MET** | The render tests assert the supplied PDF URL, `_blank`, `noopener noreferrer`, visible PDF control, a single PDF-link hook, and no `_blank` target on the row without a PDF URL. A RO/EN parameterized render asserts each locale's symbol-specific accessible name and excludes the corresponding other-locale string. |
| AC12 | **MET** | The RO/EN parameterized render checks each of the three direction strings in its `sr-only` span and excludes the corresponding other-locale string. The PDF accessible-name assertion likewise checks both locale directions; the previous-date title remains explicitly rendered and checked with the RO and EN date formats. |

Focused independent verification, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`GEMINI_API_KEY` and `GROQ_API_KEY` unset:

- `pnpm exec vitest run components/HomeTable.test.tsx` — exit 0; 1 test file passed,
  27 tests passed.

No new finding from this focused recheck. The non-round-1 manual QA items and full project
gates remain as recorded in Round 1 / the separate test verdict; this round did not re-run
them.

**Denied or attempted prohibited commands:** none.
