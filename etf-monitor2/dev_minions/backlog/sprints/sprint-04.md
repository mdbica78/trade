# Sprint 4 — Monitoring UI

> Detailed by agent (story-planner), 2026-09-25 — PO to confirm at demo.

**Epic:** EPIC-04
**Status:** see the `status.md` Story board
**Blocked by:** nothing for the agent. Every dependency below is Done or Awaiting QA (AGENTS.md, delivery loop step 1). The sprint's **live** checks need real rows in Neon, which means Sprint 3's live chain has run: `reports`/`report_values` written by at least one cron run on the deployment (US-013 AC9, US-015 AC9). The delta checks need at least two reports on consecutive calendar days. Until then the sprint is built and verified offline (PGlite, render tests), and its live steps wait in the QA checklists.

## Goal

The user can see current values, deltas and history (roadmap, Sprint 4; EPIC-04 "Done when": "the user can see current values, day-over-day deltas, and historical charts for every monitored ETF").

Concretely: the home page (`/`) replaces the Sprint 1 placeholder with a table of every monitored (active) ETF (FR7). Each row has the symbol, linked to the most recent PDF report, and one column per tracked parameter. The columns come from `tracked_fields`, not from code, so they change when the configuration changes (FR7 "configurable"). Each cell shows the latest value plus its absolute and percentage change against the previous day (FR7). A per-ETF detail page (`/etf/<symbol>`) shows the history of the tracked parameters as a table and as time-series charts (FR8). Every string is translated (FR8.1), and every number follows DEC-007 (no thousands separator, locale decimal mark). Nothing in this sprint writes to the database. There is no admin UI (Sprint 5) and no chat (Sprint 6).

## Why this order

- **US-016 first.** It builds the pieces every other story reuses: the read layer over `reports`/`report_values`/`tracked_fields` (same `BatchRunner` pattern as Sprint 3, so PGlite executes the shipped SQL offline), the DEC-007 number formatter, the report-date formatter with the `timeZone` fix from Sprint 1 audit N2, and the "only `ok` rows are shown" rule. It also makes the first product calls about what "today's value" means.
- **US-017 after US-016.** The delta is exact decimal arithmetic plus a date rule ("previous day"). It extends the home-table cells that US-016 renders, so it needs them. It is pure logic and can run in parallel with US-018.
- **US-018 after US-016.** It adds the detail route, its history read model, and the home-table link to it. It reuses US-016's formatters and read conventions.
- **US-019 last.** It adds `recharts` (ADR-001) and draws one chart per tracked field on the detail page, so it needs US-018's page and history data.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-016 | Home table with configurable columns and PDF links | US-004, US-005, US-012, US-014 | strong model, high thinking. Complex (new read layer on PGlite, shared formatters, 11 ACs) → `story-planner` plan |
| US-017 | Day-over-day delta calculation (absolute and percentage) | US-016 | mid model, medium thinking. Complex (exact decimal arithmetic, date rule, 8 ACs) → `story-planner` plan |
| US-018 | ETF detail page: historical values table | US-016 | mid model, medium thinking. Complex (new route, read model, 10 ACs) → `story-planner` plan |
| US-019 | ETF detail page: time-series charts for tracked fields | US-018 | mid model, medium thinking. Complex (new runtime dependency listed in ADR-001, client component, 8 ACs) → `story-planner` plan |

## Decisions needed (collected from the stories)

None of these blocks a story. Where a literal reading of the FR exists, the story ships it. Where no literal reading exists, the story ships the recommendation, isolated in one function or component so the PO can change it at the demo. The TECHNICAL items are for the in-loop `tech-lead` to settle in the sprint review (DEC-009).

| # | Story | Type | Question | Recommendation (shipped unless the tech-lead / PO decides otherwise) |
|---|---|---|---|---|
| 1 | US-016 | PRODUCT | What is "today's value" (FR7)? A report for day D is filed on D+1 (`test/fixtures/bvb/README.md` §4), so `report_date = today` never exists when the table is viewed. | The value from the ETF's newest `ok` report, with that report's date shown in the row so staleness is visible. |
| 2 | US-016 (applies to all four) | PRODUCT | Values stored under `parse_error` rows (Sprint 3 decision 5, forward note in sprint-03.md): show them, or show only `ok` rows? | Show only `ok` rows in the home table, deltas, history and charts. Parse errors become visible in the admin dashboard (US-024, FR13). |
| 3 | US-016 | TECHNICAL | ETFs can track different fields. How do per-ETF tracked fields become one set of table columns, and which label heads a column? | Columns = the union of the active ETFs' tracked `field_key`s, ordered by the lowest `display_order` any ETF gives the field, then `field_key`. A cell for a field that ETF does not track is empty. The header is the `field_catalog` label for the locale (first matching `adapter_key` alphabetically); `field_key` if no catalogue entry exists. |
| 4 | US-016 | TECHNICAL | Time zone for next-intl (Sprint 1 audit N2). | `timeZone: "Europe/Bucharest"` in `i18n/request.ts`, as the audit says. Report dates are date-only strings and are formatted without any time-zone conversion. |
| 5 | US-016 | PRODUCT | Report-date display format per locale. DEC-007 covers numbers only. | `ro`: `22.09.2026` (the format BVB itself uses). `en`: `2026-09-22` (ISO, unambiguous). One formatter function. |
| 6 | US-017 | PRODUCT | "Previous day" for the FR7 delta (Sprint 3 forward note). Under US-012 PRODUCT 2's literal reading, Friday and Saturday reports are never stored, every week. | The `ok` report for the calendar day before the shown report's date. If there is none, the delta is blank (FR7 "previous day" literally; FR4.1 "blank"). With the literal catch-up reading this blanks one delta per week (the Sunday report). If the PO later chooses catch-up option B, every day has a report and nothing is blank. |
| 7 | US-017 | PRODUCT | Delta display: percentage precision, rounding, sign. | Percentage rounded to 2 decimals, half away from zero, computed exactly. Both deltas show an explicit sign (`+`/`-`), zero shows none. `%` follows the number with no space in both locales. A previous value of 0 gives a blank percentage. No colour requirement. |
| 8 | US-018 | PRODUCT | How FR8's "clicking an ETF in the table" works when the symbol already links to the PDF (FR7). | A separate, translated per-row link ("Istoric" / "History") to `/etf/<symbol>`. The symbol keeps its PDF link. |
| 9 | US-018 | PRODUCT | Days without an `ok` report in the history table: omit them, or list them as blank rows? | Omit them. The table lists only dates that have an `ok` report, newest first. Missing days are never filled (FR4.1). The chart shows the gaps (US-019). |
| 10 | US-018 | PRODUCT | Detail page of a deactivated ETF (`is_active = false`, soft removal). | Still reachable by URL, showing its stored history. The home table does not link to it, because it lists only active ETFs. |
| 11 | US-019 | TECHNICAL | One chart per tracked field, or one combined chart? | One chart per tracked field. Units and magnitudes differ (`RON` vs `count` in `field_catalog.unit`), so one shared axis would flatten every series but one. |
| 12 | US-019 | PRODUCT | Chart gaps and time range. bvb.ro charts have range selectors. | Break the line at a missing calendar day, never interpolate (FR4.1). Show the whole stored history, with no range selector for now. A range selector is a follow-up story if the PO wants it. |

**Tech-lead sprint review 2026-09-25** (`verification/SPRINT-04-review.md`): the technical items #3, #4 and #11 are **Decided** as recommended. The PRODUCT items (#1, #2, #5, #6, #7, #8, #9, #10, #12) stay **NEEDS USER** at the demo. None of them blocks a story. Each ships either the literal FR reading or, where no literal reading exists, one isolated default.

## Sprint Definition of Done

- All four stories reviewed and tested (PASS/PASS), Awaiting QA, then accepted by the user.
- `pnpm test` runs fully offline and proves:
  - the home table lists every active ETF, takes its columns from `tracked_fields`, shows the newest `ok` values and the newest PDF link, and never invents a value or a link (US-016);
  - every number follows DEC-007 in both locales, with no rounding of stored digits (US-016);
  - the absolute and percentage deltas are exact, use the calendar day before, and are blank when that day has no value (US-017);
  - the detail page shows one row per `ok` report date for the tracked fields, and returns 404 for an unknown symbol (US-018);
  - one chart per tracked field, gaps not interpolated, tooltips and axes in the DEC-007 format (US-019).
- Read queries are tested on PGlite against `drizzle/0000_init.sql`, with the same statements the pages run. No test connects to Neon.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass, and `pnpm build` passes with `DATABASE_URL` unset.
- A clean `pnpm install --frozen-lockfile` (empty `node_modules`) passes after `recharts` is added (US-008 lesson).
- **No schema change.** Sprint 4 only reads. If a plan finds a schema change necessary, the migration is generated locally and never applied to Neon by an agent (AGENTS.md).
- The user has run the live checks below and confirmed the PRODUCT decisions above.

## Manual QA the user must perform in this sprint

Needs Sprint 3's live chain first: the deployment has run the daily job at least once, so Neon holds `ok` reports. Step 3 needs reports on two consecutive calendar days. The Codex QA loop can check the offline and locally-served parts (`scripts/claude/qa-serve.sh`: a local serve without `DATABASE_URL` shows the translated error state, not a crash). Everything below needs your Neon data, so it is yours.

1. **Home table.** Open `https://<your-app>.vercel.app/`. Expected: one row per active ETF (three after the seed), columns "Unități de fond în circulație" and "Valoare unitară a activului net (VUAN)" in Romanian, and a report date per row.
2. **PDF links and values.** Click each symbol. The newest depositary PDF opens in a new tab. The values in the row match that PDF (when the newest report is `ok`), shown with no thousands separator and a comma decimal mark (DEC-007).
3. **Deltas.** Pick one ETF and one field. Open the PDF for the shown date and the PDF for the calendar day before. Check the absolute change and the percentage (2 decimals) by hand. On the day the table shows a Sunday report, the delta is expected to be blank (decision 6, under the literal catch-up reading).
4. **Language.** Switch to EN. Headers become "Units in circulation" / "Net asset value per unit", the decimal mark becomes a dot, and the date format changes (decision 5). Switch back to RO.
5. **Configurable columns.** In the Neon SQL editor:
   `insert into tracked_fields (etf_id, field_key, display_order) select id, 'net_asset', 2 from etfs where symbol = 'BTBETRETF';`
   Reload the home page. An "Activ net" column appears. It stays empty for BTBETRETF until a new report is ingested (under US-012 PRODUCT 1's literal reading only tracked fields are stored), and it is empty for the other ETFs, which do not track it. Undo with
   `delete from tracked_fields where field_key = 'net_asset' and etf_id = (select id from etfs where symbol = 'BTBETRETF');`
6. **Detail page.** Click a row's "Istoric" link. Expected: `/etf/<SYMBOL>`, a history table with one row per stored report date (newest first), and one chart per tracked field below it. Open `/etf/NOPE`: a 404 page.
7. **Charts (PO judgment).** FR8 asks for charts "styled similarly to the charts on bvb.ro". Compare with the chart on the instrument's bvb.ro page and say whether this is close enough. Hover a point: the tooltip shows the date and the value in the DEC-007 format.
8. **PO confirmation:** every story in this sprint was drafted by an agent. Confirm or correct the acceptance criteria, and answer the PRODUCT items in the table above (#1, #2, #5, #6, #7, #8, #9, #10, #12). The two open Sprint 3 PRODUCT items from US-012 bear on this sprint: "tracked vs all fields" decides whether a newly tracked field has history (step 5), and "catch-up filings" decides whether #6, #9 and #12 leave weekly gaps. Answering them at the same demo is easiest.

## Notes for whoever details Sprint 5 (forward flags, not Sprint 4 scope)

- **US-021 (tracked fields)** edits exactly the rows that drive the home-table columns. It must keep decision 3's union/order rule in mind. `display_order` is per ETF, but the columns are shared.
- **US-024 (dashboard)** is where `parse_error` rows and their stored values become visible, if decision 2 stands. It also translates the outcome codes that US-015 writes into `job_runs.log` (FR8.1).
- **US-030** adds the report link for no-adapter ETFs. US-016 already lists them with an "extraction unavailable" marker and no link.
- The read layer from US-016 (`BatchRunner` + PGlite tests) is the pattern for Sprint 5's admin reads. If the plan moved `BatchRunner`/`rowsOf` out of `lib/ingestion/store.ts` into a shared module, Sprint 5 should use that module.
- DEC-007 is still not folded into `requirements/` (PO todo). Decision 5 (date format) and decision 7 (delta format), once confirmed, belong in the same place.
