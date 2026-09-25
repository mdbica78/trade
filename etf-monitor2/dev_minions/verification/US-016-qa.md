# US-016 — QA checklist (Home table with configurable columns and PDF links)

Round 1: review PASS, tests PASS (649/650 total, 51 new — 1 unrelated transient timeout in a
US-015 file, confirmed environmental by an isolated rerun). See `US-016-review.md` /
`US-016-tests.md` for full evidence. Both technical decisions (#3 columns=union, #4 timeZone)
were already Decided by the tech-lead sprint review before implementation; product decisions
#1, #2, #5 are implemented as the story's recommended default (A in each case) and stay
non-blocking, PO-confirm-at-demo — see the story's "Decisions needed" section.

## Automated (already verified by this loop, no action needed)
- AC1 (one row per active ETF, ordered by symbol; inactive excluded; no-report/null-adapter
  rows still shown) — `home.pglite.test.ts` "AC1"
- AC2 (columns from `tracked_fields` configuration, union + display_order/field_key ordering,
  tracked/untracked cell distinction, catalogue label with field_key fallback and alphabetical
  adapter tie-break) — 6 tests in `home.pglite.test.ts`, header locale rendering in
  `HomeTable.test.tsx`
- AC3 (values/date from the newest `ok` report only, never an older report, `parse_error` rows
  ignored even with stored values) — 3 tests in `home.pglite.test.ts`
- AC4 (symbol links to the newest report's `source_url` regardless of status, opens in a new
  tab, plain text when none) — 2 tests in `home.pglite.test.ts`, 1 in `HomeTable.test.tsx`
- AC5 (extraction-unavailable marker for NULL or unregistered `adapter_key`) —
  `home.pglite.test.ts`, `HomeTable.test.tsx`
- AC6 (DEC-007 number formatting, all literal examples + grouping-character adversarial case) —
  `lib/format/number.test.ts`
- AC7 (report date format per locale, calendar-day-stable across process time zone) —
  `lib/format/date.test.ts`
- AC8 (bilingual, key parity, no cross-locale leakage) — `i18n/messages.test.ts`,
  `HomeTable.test.tsx`, `app/page.test.tsx`
- AC9 (empty state, generic error message, no exception/secret leakage) — `app/page.test.tsx`
- AC10 (offline PGlite-only tests; `pnpm build` with `DATABASE_URL` unset passes, `/` is dynamic)
  — `home.pglite.test.ts` + direct build run recorded in `US-016-tests.md`
- AC11 (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) — all green

## MANUAL-QA — live Vercel/Neon, for the Codex QA/Deploy loop or the user
Needs Sprint 3's live chain already run at least once (Neon holds `ok` reports from the daily
cron). Sprint-04.md's own note: "The Codex QA loop can check the offline and locally-served
parts (`scripts/claude/qa-serve.sh`: a local serve without `DATABASE_URL` shows the translated
error state, not a crash). Everything below needs your Neon data, so it is yours."

1. **Home table.** Open `https://<your-app>.vercel.app/`. Expected: one row per active ETF
   (three after the seed), columns for every tracked field (labels in Romanian by default), and
   a report date per row.
2. **PDF links and values.** Click each symbol. The newest depositary PDF opens in a new tab.
   The values in the row match that PDF (when the newest report is `ok`), shown with no
   thousands separator and a comma decimal mark (DEC-007).
3. **Language.** Switch to EN. Headers change to their English catalogue labels, the decimal
   mark becomes a dot, and the date format changes from `dd.MM.yyyy` to ISO. Switch back to RO.
4. **Configurable columns.** In the Neon SQL editor:
   `insert into tracked_fields (etf_id, field_key, display_order) select id, 'net_asset', 2 from etfs where symbol = 'BTBETRETF';`
   Reload the home page. A new column for that field appears. It is empty for BTBETRETF until a
   new report is ingested, and empty for the other ETFs, which do not track it. Undo with
   `delete from tracked_fields where etf_id = (select id from etfs where symbol = 'BTBETRETF') and field_key = 'net_asset';`
   and confirm the column disappears again.
5. **No active ETF (optional negative check).** Temporarily
   `update etfs set is_active = false;`, reload — the page shows the translated empty-state
   message, not an error or a crash. Undo with `update etfs set is_active = true;` (only if you
   ran this step).

## Non-blocking notes carried from review
- `HomeTable.test.tsx`/`app/page.test.tsx` print a harmless `IntlError: ENVIRONMENT_FALLBACK`
  warning to stderr during test runs (no `timeZone` on the test-only `NextIntlClientProvider`);
  pre-existing pattern, does not affect this story's date/number formatting (both are pure
  string functions, no `Intl` call).
- `dev_minions/architecture/data-model.md` still documents `.` as the numeric thousands
  separator, a pre-existing doc gap unrelated to this story (already flagged in an earlier
  sprint audit).
- Product decisions #1 ("today's value" = newest `ok` report), #2 (hide `parse_error` values)
  and #5 (date format) are implemented as their recommended default; PO confirmation is deferred
  to the demo per the story text, not blocking this QA pass.

## Files changed
- `lib/format/number.ts`, `lib/format/number.test.ts`
- `lib/format/date.ts`, `lib/format/date.test.ts`
- `lib/monitoring/home.ts`, `lib/monitoring/home.pglite.test.ts`
- `components/HomeTable.tsx`, `components/HomeTable.test.tsx`
- `app/page.tsx`, `app/page.test.tsx`
- `i18n/request.ts`
- `messages/ro.json`, `messages/en.json`
- Deleted: `lib/format.ts`, `lib/format.test.ts`
