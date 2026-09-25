# US-018 — Tests: ETF detail page, historical values table

**Round 1 — 2026-09-25**

Verdict: **PASS**

## Commands

| Command | Exit code | Result |
|---------|-----------|--------|
| `pnpm install` | 0 | ✓ Already up to date |
| `pnpm typecheck` | 0 | ✓ No errors |
| `pnpm lint` | 0 | ✓ 3 warnings (known, non-blocking) |
| `pnpm test` | 0 | ✓ 744 tests passed, 56 files |
| `pnpm build` | 0 | ✓ `ƒ /etf/[symbol]` dynamic route, `DATABASE_URL` unset |

## Acceptance criteria → tests

All criteria met. Test mapping below (test names searchable in files listed).

| AC | Criterion | Coverage |
|---|---|---|
| **AC1** | Route `/etf/<SYMBOL>` renders page with symbol and name. Unknown symbol → 404 via `notFound()`. Lookup by exact symbol. | `app/etf/[symbol]/page.test.tsx`: "AC1: renders a heading with the symbol and stored name when the loader finds the ETF", "AC1: passes the exact symbol from params to the loader", "AC1: an unknown symbol calls notFound() exactly once, outside the error handler". `lib/monitoring/history.pglite.test.ts`: "AC1: unknown symbol gives null, no ETF row is created or altered", "AC1: exact match only, case-sensitive, no trimming", "AC1: a SQL-injection-shaped symbol is just a literal string, no row matches, table untouched", "AC1: symbol is a bound parameter, never interpolated into the SQL text", "AC1: returns the ETF's symbol, stored name and is_active". |
| **AC2** | Home-table navigation. Every row has a translated link to `/etf/<symbol>`, separate from the symbol's PDF link. | `components/HomeTable.test.tsx`: "US-018 AC2: each row has a translated history link, separate from the symbol's PDF link", "the symbol is a link when latestPdfUrl exists, plain text otherwise". |
| **AC3** | History table. One row per `ok` report, newest first. One column per tracked field, `display_order` then `field_key` order, headed by catalogue label or field_key fallback for the ETF's own adapter. Cells are stored values via `formatNumber`, missing values are empty. Untracked fields never appear. | `components/HistoryTable.test.tsx`: "renders the date column header, field header and formatted values for locale %s", "a null value renders exactly an empty <td>", "never contains a grouping character in either locale", "row order follows the props order (newest first, as the read model provides)". `lib/monitoring/history.pglite.test.ts`: "AC3(a): rows are ordered newest report_date first, regardless of insertion order", "AC3(b): field order is display_order then field_key", "AC3(c): labels come from the ETF's own adapter, not the alphabetically first one", "AC3(c): no catalogue row, or a NULL adapter_key, falls back to field_key", "AC3(d): only tracked fields appear, an untracked stored field never appears anywhere in the result", "AC3(e): a missing value for a tracked field is null; a report with no values still yields a row with every value null", "AC3(f): another ETF's reports never appear". |
| **AC4** | Missing days never filled. No gap-filling, no carried-forward values. | `lib/monitoring/history.pglite.test.ts`: "AC4: missing calendar days are never filled, no carried-forward value". |
| **AC5** | Only `ok` reports appear. `parse_error`, `missing`, `no_adapter` rows excluded entirely. | `lib/monitoring/history.pglite.test.ts`: "AC5: only ok reports appear; parse_error, missing and no_adapter rows are all excluded", "AC5: an ETF whose only report is parse_error has an empty history". |
| **AC6** | States. No `ok` report → translated "no history yet". No tracked fields → translated message. DB error → translated generic message, no exception text, no environment values. | `components/EtfDetail.test.tsx`: "shows the translated error message on status:error, never a raw exception string", "no ok report -> translated noHistory message, heading still shown, no table", "no tracked fields -> translated noTrackedFields message, no table", "neither fields nor rows -> noTrackedFields alone, noHistory is absent (precedence, plan §4.4)". `app/etf/[symbol]/page.test.tsx`: "AC6: a loader error shows a translated message, never the exception text, and does not call notFound()", "AC6: an error whose message contains a DATABASE_URL-shaped marker never leaks it", "AC6: getDb() itself throwing (e.g. MissingDatabaseUrlError) also gives the translated error, not a crash". `lib/monitoring/history.pglite.test.ts`: "AC6 (read-model shapes): no tracked fields -> fields: []; no ok report -> rows: []". |
| **AC7** | Deactivated ETF. `is_active = false` still renders stored history. Home table does not list it (US-016 AC1). | `components/EtfDetail.test.tsx`: "an inactive ETF's history still renders its table". `lib/monitoring/history.pglite.test.ts`: "AC7: an inactive ETF's history still loads in full". Home table inactive exclusion: citation to US-016 `home.pglite.test.ts` "AC1: ... inactive excluded". |
| **AC8** | Bilingual via next-intl. Every new string in both catalogues. Key parity passes. Render tests in `ro` and `en` show locale's headers, date format (US-016 decision 5), decimal mark (DEC-007). Stored name shown untranslated. | `components/HistoryTable.test.tsx`: "renders the date column header, field header and formatted values for locale %s" (both locales). `components/EtfDetail.test.tsx`: "the stored name is shown byte-identical in both locales (never translated)", "ro and en renders never contain the other locale's differing state text". `app/etf/[symbol]/page.test.tsx`: "ro and en renders never contain the other locale's differing text". `components/HomeTable.test.tsx`: "US-018 AC2: each row has a translated history link, separate from the symbol's PDF link" (both locales). `i18n/messages.test.ts` (unchanged, key parity, non-empty leaves): 4 tests pass. New message keys added: `Home.historyLink`, `EtfDetail.{dateColumn,noHistory,noTrackedFields,loadError}`. |
| **AC9** | Offline and build-safe. Read-model tests on PGlite with shipped statements, no Neon. `pnpm build` passes with `DATABASE_URL` unset. | All read-model tests use `createTestDatabase()` and `createEtfHistoryLoader(db.mockDb, db.runner)`. Page test mocks `@/lib/db`, `@/lib/monitoring/history`, `next/navigation`. Component tests render with mocked next-intl. Build output shows `ƒ /etf/[symbol]` (dynamic). No test imports `@neondatabase/serverless` or unset `DATABASE_URL` read. |
| **AC10** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass. | All 5 commands exit 0. Typecheck, lint and build output shown above. Test suite: 744 tests across 56 files, all pass. |

## Notes

- Three expected lint warnings (unused test parameters `_deps`, `_text`, `_statements`) in files from US-011–US-015; exits 0.
- US-016/US-017 regression: `HomeTable.test.tsx` lines 53–56 changed from asserting a single total `<a>` count to testing PDF and history links separately; confirms both exist and the PDF link is unchanged.
- All new messages added to both `messages/ro.json` and `messages/en.json`. Romanian copy approved per US-004 precedent (user confirms at demo).
- Dynamic route confirmed: `pnpm build` with no `DATABASE_URL` shows `ƒ /etf/[symbol]`, matching the base route `ƒ /` pattern (established in US-016).
- Read model uses `to_char(report_date, 'YYYY-MM-DD')` in SQL to return a string, avoiding the PGlite `Date` parsing trap documented in US-016 HANDOVER note; no timezone dependencies in tests.
