# US-036 independent test verdict

## Round 1

**Verdict: FAIL** — all requested executable gates passed, but several acceptance-criterion test assertions are missing. These are verification-coverage gaps; the run did not expose a failing application behavior.

### Environment and commands

All commands ran serially through WSL `bash -lc` from `/mnt/c/_mystaff/myG/trade/etf-monitor2`, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `GEMINI_API_KEY`, and `GROQ_API_KEY` unset in each command. No live database, provider, or deployment was accessed.

| Command | Exit | Result |
|---|---:|---|
| `pnpm exec vitest run components/HomeTable.test.tsx app/page.test.tsx app/page.wrapper.test.tsx app/globals.home-table.test.ts lib/monitoring/delta.test.ts lib/monitoring/home-delta.test.ts lib/monitoring/home-delta.pglite.test.ts lib/monitoring/home.pglite.test.ts lib/monitoring/home-display.pglite.test.ts scripts/qa/render-home.test.tsx scripts/qa/boundaries.test.ts i18n/messages.test.ts` | 0 | 12 files passed; 107 tests passed. |
| `pnpm typecheck` | 0 | `tsc --noEmit` passed. |
| `pnpm lint` | 0 | 0 errors; 9 warnings. Warnings are in `app/health/page.failure.test.tsx`, `lib/ai/providers/timeout.test.ts`, `lib/cron/default-deps.seam.test.ts`, `lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`, and `lib/ingestion/load-etfs.test.ts`. |
| `pnpm build` | 0 | Offline build passed; migration step reported `skipped (not a production build)`; all 12 routes built. |
| `pnpm exec vitest run` | 0 | 195 files passed; 1942 tests passed. |

The exact WSL command form for each row was `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && <command>'`.

### Acceptance criteria

| AC | Result | Independent evidence |
|---|---|---|
| AC1 | **NOT MET** | `components/HomeTable.test.tsx` passes its AC1 row-link tests for regular and no-adapter symbols; `app/globals.home-table.test.ts` passes HR-1; the source uses `encodeURIComponent`. However, no render test supplies a symbol requiring URL encoding, as AC1 requires. |
| AC2 | **NOT MET** | `components/HomeTable.test.tsx` passes the English PDF URL/target/rel/accessible-name assertion and verifies the PDF control is omitted when there is no URL; HR-2 passes. The PDF accessible name is not asserted in a Romanian render, and the no-URL case does not assert absence of every `_blank` link. |
| AC3 | **NOT MET** | `lib/monitoring/home-display.pglite.test.ts` asserts `etfs.name` in both the unsaved and saved-view branches. `components/HomeTable.test.tsx` asserts the names render in their own elements and tests the extraction-unavailable text. The component retains its `data-extraction-unavailable` hook, but no render assertion checks that hook as AC3 requires. |
| AC4 | **MET** | All 11 tests in `lib/monitoring/home-delta.pglite.test.ts` pass against PGlite, covering Friday-to-Monday, `parse_error`, per-field lookback, missing/null values, zero previous value, and month/year/leap-year boundaries. |
| AC5 | **MET** | `lib/monitoring/delta.test.ts` passes all 30 arithmetic/source-scan tests. The PGlite zero-divisor case and `HomeTable.test.tsx` no-percent case pass; `lib/monitoring/home-delta.test.ts` passes the guard against `previousCalendarDay` in `computeCellDelta`. |
| AC6 | **NOT MET** | `components/HomeTable.test.tsx` verifies gain/loss/flat glyphs and accessible text, independent switches, missing percent, and previous-date title formatting in both locales. Its ordering assertion checks absolute-before-percent but does not assert that the arrow precedes the absolute value, as AC6 requires. |
| AC7 | **NOT MET** | `components/HomeTable.test.tsx` verifies numeric values and delta formatting in RO/EN; HR-3 verifies numeric alignment and tabular digits. No HomeTable render assertion verifies the value-date cell's P5 date format in both locales. |
| AC8 | **MANUAL-QA** | HR-4 and `app/page.wrapper.test.tsx` pass the no-wrap hook and scroll-wrapper checks. The required 390px browser check for internal table scrolling, no page overflow, and no wrapping was not run. |
| AC9 | **MANUAL-QA** | The focused and full suites pass the current HomeTable/page behavior assertions for values, PDF URL/target/rel, extraction-unavailable marker, and empty/error states. The constraint that no tests outside the permitted scope were changed cannot be independently established without a version-control comparison; no git command was run. |
| AC10 | **MANUAL-QA** | No screenshot comparison against the four binding design PNGs was performed in this test run. |
| AC11 | **MET** | `scripts/qa/render-home.test.tsx` passes both harness tests, including four locale/theme documents, shipped HomePageBody markup, three open customization groups, and copied stylesheet references. `scripts/qa/boundaries.test.ts` passes the app/lib/components import-boundary test. The runbook checklist is a post-verification handoff artifact and was not present during this test phase. |
| AC12 | **NOT MET** | `i18n/messages.test.ts` confirms catalogue key parity and non-empty strings; the HomeTable suite verifies locale-specific previous-date titles and English arrow/PDF labels. It does not render/assert the new PDF accessible name and all three arrow texts in both locales, nor prove each locale excludes the other's new texts. |
| AC13 | **MET** | Typecheck, lint, offline build, focused tests, and the full suite all exited 0 with the listed environment variables unset. `tsx` is already present in `package.json`; no additional harness dependency is required. |

### Denied or attempted commands

None. No git, secret-reading, deployment, or Neon migration command was run.

## Round 2

**Verdict: PASS** — the round-1 automated coverage gaps are now asserted by the current tests, and every requested executable gate passed. AC8, AC9, and AC10 retain the manual / independently unverifiable items noted below; these did not fail an executable gate.

### Environment and commands

Each command ran serially through `wsl.exe bash -lc` from `/mnt/c/_mystaff/myG/trade/etf-monitor2`, after unsetting `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `GEMINI_API_KEY`, and `GROQ_API_KEY`. No variable values were read or printed. No live database, provider, or deployment was accessed.

| Command | Exit | Result |
|---|---:|---|
| `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && pnpm exec vitest run components/HomeTable.test.tsx app/page.test.tsx app/page.wrapper.test.tsx app/globals.home-table.test.ts lib/monitoring/delta.test.ts lib/monitoring/home-delta.test.ts lib/monitoring/home-delta.pglite.test.ts lib/monitoring/home.pglite.test.ts lib/monitoring/home-display.pglite.test.ts scripts/qa/render-home.test.tsx scripts/qa/boundaries.test.ts i18n/messages.test.ts'` | 0 | 12 files passed; 112 tests passed. `HomeTable.test.tsx`: 27 passed; `home-delta.pglite.test.ts`: 11 passed; `delta.test.ts`: 30 passed; `app/globals.home-table.test.ts`: 6 passed; render harness: 2 passed; boundary: 1 passed. |
| `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && pnpm typecheck'` | 0 | `$ tsc --noEmit` |
| `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && pnpm lint'` | 0 | `✖ 9 problems (0 errors, 9 warnings)`; warnings are in the same unrelated files listed in round 1. |
| `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && pnpm test'` | 0 | `Test Files 195 passed (195); Tests 1947 passed (1947)` |
| `wsl.exe bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && unset DATABASE_URL CRON_SECRET VERCEL_ENV GEMINI_API_KEY GROQ_API_KEY && pnpm build'` | 0 | `migrate-on-deploy: skipped (not a production build)`; optimized build compiled; all 12 dynamic routes built. |

### Acceptance criteria

| AC | Result | Independent evidence |
|---|---|---|
| AC1 | **MET** | The focused run passed `components/HomeTable.test.tsx` (27 tests) and `app/globals.home-table.test.ts` (6 tests). HomeTable assertions cover the detail link on the rows (including the no-adapter/no-PDF row), the stretched-link/row hooks, one detail link per row, and no separate History link. The new reserved-character case asserts symbol `A/B` renders as `href="/etf/A%2FB"`. |
| AC2 | **MET** | HomeTable assertions passed for the exact report URL, `_blank`, `noopener noreferrer`, PDF hook, accessible name naming the symbol, and the no-PDF row's lack of a `_blank` link. The `ro` and `en` cases assert the localized accessible name and absence of the other locale's text. The stylesheet test suite passed its PDF-control stacking/border assertions. |
| AC3 | **MET** | `HomeTable.test.tsx` now asserts the ETF name in its own element and the no-adapter marker's `data-extraction-unavailable` hook. The focused PGlite display-read-model tests passed both unsaved and saved-view loader branches for ETF names. |
| AC4 | **MET** | All 11 `home-delta.pglite.test.ts` tests passed against PGlite, including Friday-to-Monday lookback, `parse_error` handling, per-field earlier-value lookup, null/missing values, zero prior value, and month/year/leap-year boundaries. |
| AC5 | **MET** | All 30 `lib/monitoring/delta.test.ts` tests passed, including exact arithmetic/source-scan assertions. The focused PGlite and component cases also passed for zero prior value, null percent, and no `previousCalendarDay` check in the cell-delta path. |
| AC6 | **MET** | The HomeTable suite passed assertions that the arrow precedes absolute then percent; gain/loss/flat glyph and tone are distinct; direction text is accessible; independently disabled parts disappear; a null delta omits the line; and the previous-date title is localized/formatted for `ro` and `en`. |
| AC7 | **MET** | The HomeTable locale cases passed for localized value/date and delta formatting. `app/globals.home-table.test.ts` passed its numeric alignment/tabular-digit assertions. |
| AC8 | **MANUAL-QA** | The focused stylesheet and page-wrapper tests passed for date/numeric no-wrap hooks, table minimum width and scroll wrapper. The requested 390px rendered-browser check (internal table scrolling, no page overflow, and no wrapping) was not run in this tester round. |
| AC9 | **MANUAL-QA** | The focused component/page tests passed the retained value, extraction-unavailable, PDF URL/target/rel, error and empty-state assertions. Whether test edits were limited to the permitted files cannot be independently established without a version-control comparison; no git command was run. |
| AC10 | **MANUAL-QA** | No new screenshot comparison against the four binding design PNGs was performed in this test round. |
| AC11 | **MET** | The focused harness suite passed both render tests, including the locale/theme documents and shipped table/panel markup. `scripts/qa/boundaries.test.ts` passed its application-import boundary check. |
| AC12 | **MET** | `i18n/messages.test.ts` passed key parity. The HomeTable suite passed `ro`/`en` PDF accessible-name and arrow-direction text assertions, verifies the opposite locale's text is absent, and verifies the previous-date title in both formats. |
| AC13 | **MET** | Focused suite, typecheck, lint, full suite and offline build all exited 0 with all five specified variables unset. Full regression: 195 files / 1947 tests; build: all 12 dynamic routes. |

### Denied or attempted commands

None. No git, secret-reading, deployment, or Neon migration command was run.
