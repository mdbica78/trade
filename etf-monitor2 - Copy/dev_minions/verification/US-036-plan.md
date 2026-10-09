# US-036 plan — Home table look (symbol → detail page, per-field previous-available delta)

Planned inline (Copilot fallback; `story-planner` unavailable). Follows the Task/AC breakdown
already in `dev_minions/backlog/stories/US-036.md`. T-2 (delta rule), row-click (stretched link),
P-2 (flat marker `–`) and D-7 (QA harness recommendation (a)) are already Decided by the Sprint 9
review — not re-litigated here.

## Files to touch
- `lib/monitoring/home.ts` — replace `buildPreviousDayOkValuesStatement` with
  `buildPreviousAvailableValuesStatement` (per-field newest earlier `ok` report with a non-null
  value, not "exactly one calendar day before"); `parsePreviousValues` keyed per `(etfId, fieldKey)`;
  `computeCellDelta` drops the `previousCalendarDay` check, gains `previousDate` on the returned
  cell delta; `HomeRow` gains `name: string` (already selected/parsed as `etf.name`, just not
  surfaced on the row); `HomeCell`'s delta type becomes `Delta & { previousDate: string }`.
- `lib/monitoring/home-delta.pglite.test.ts` — rewritten for the new rule (deliberate, AC4): a
  gap of more than one day now yields a real delta against the older report instead of `null`.
- `lib/monitoring/home.pglite.test.ts` / other `home*.test.ts` — add `name` to fixtures where the
  shape is asserted directly (type-only fallout, not a behaviour change).
- `components/HomeTable.tsx` — row gets `position: relative`/`data-home-row`; first cell holds the
  PDF button (a real `<a>`, `data-home-pdf-link`, higher stacking) and the ETF name; the symbol
  becomes the row's stretched link to `/etf/<symbol>` (`data-home-row-link`, `::after` in CSS);
  the old separate "History" text link and `Home.historyLink` key are removed; the value cell
  gains a change-line (`data-home-change`) under the number, arrow/absolute/percent per column
  toggle, with `title` reading the compared previous date; flat is dash-only per P-2.
- `components/HomeTable.test.tsx` — rewritten row-shape assertions (deliberate, AC9): the
  `historyLink` assertions are replaced by assertions on the new stretched row-link; the
  `<td>NOADAPTER<span ...>` assertion keeps its hook but the surrounding row markup changes.
- `app/globals.css` — `[data-home-row]{position:relative}`, `[data-home-row-link]::after` stretch,
  `[data-home-pdf-link]{position:relative;z-index:1}`, `[data-home-change]` layout + no-wrap rules
  for the phone width (AC8).
- `messages/en.json`, `messages/ro.json` — remove `Home.historyLink`; add `Home.pdfLinkLabel`
  (aria-label for the PDF button) and `Home.previousDateTitle` (the change-line `title` template).
- `scripts/qa/render-home.ts` (new) — D-7 option (a): renders the exact composed home body
  (`HomeCustomizePanel` + scroll wrapper + `HomeTable`) with a committed fixture view model to
  static HTML files under `dev_minions/verification/qa-render/` for Codex to screenshot; a
  boundary test (`scripts/qa/boundaries.test.ts`) asserts nothing under `app/`/`lib/`/`components/`
  imports from `scripts/qa/`.
- `dev_minions/architecture/data-model.md` — one-line note: the home table's previous-value
  comparison is per-field, not per-calendar-day.

## Tests → acceptance criteria
AC1–AC3 (row/PDF-button/name markup) → `HomeTable.test.tsx` new row-shape assertions.
AC4/AC5 (delta rule + arithmetic boundary) → `home-delta.pglite.test.ts` rewrite + a source-scan
test asserting `computeCellDelta`'s body has no `previousCalendarDay` reference.
AC6 (change-line rendering/order) → `HomeTable.test.tsx` delta describe block, extended for the
`previousDate` title and the flat dash.
AC7 (number format/alignment) unaffected — reuses `formatNumber`/`formatDeltaAbsolute` unchanged.
AC8 (phone no-wrap) → CSS rule + MANUAL-QA screenshot step in `US-036-qa.md`.
AC9 (deliberate markup changes) → logged in HANDOVER.md, this plan.
AC10 (design reference) → MATCH/DEVIATION recorded in HANDOVER after implementing, table scope only.
AC11 (QA harness) → `scripts/qa/render-home.ts` + its own smoke test + boundary test.
AC12 (bilingual keys) → both message catalogues, `HomeTable.test.tsx` ro/en assertions.
AC13 (gates) → `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
