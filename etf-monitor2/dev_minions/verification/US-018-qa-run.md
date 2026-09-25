# US-018 — Codex QA run

**Run:** 1  
**Date:** 2026-09-25 16:25  
**Verdict:** PASS — automated and auto-partial checks passed. Production-data and product/copy confirmations remain for the user.

## Evidence

| Check | Classification | Result | Evidence |
| --- | --- | --- | --- |
| AC1–AC8 focused history read-model, detail page, table, navigation, and message tests | Auto | PASS | Focused Vitest run completed: 6 files, 53 tests, using PGlite and mocked page dependencies only. |
| AC9/AC10 full regression/typecheck/build | Auto | PASS | The immediately preceding independent offline full run completed `pnpm typecheck`, 56 test files / 744 tests, lint, and `pnpm build` with `DATABASE_URL` unset. The build reported `/etf/[symbol]` as dynamic. |
| Lint | Auto | PASS | Exit 0 with only the three known unused helper/type-parameter warnings: `_deps`, `_text`, `_statements`. |
| Local known ETF route | Auto | PASS | Required `qa-serve.sh` returned HTTP 200 for `/etf/BTBETRETF` with no database and showed the translated generic error, not a crash. |
| Local unknown ETF route | Auto-partial | PASS | Required `qa-serve.sh` returned HTTP 200 for `/etf/NOPE` with no database and showed the same generic error. This is expected: without a database the app cannot distinguish an unknown symbol from a lookup failure. |
| English local detail route and cleanup | Auto-partial | PASS | `/etf/BTBETRETF` with `NEXT_LOCALE=en` returned HTTP 200 with the English generic error; `qa-serve.sh stop` completed. |

## User checks still needed

- [LIVE-DB] After deploying, confirm each production home row has a separate “Istoric”/“History” detail link while the symbol still opens the newest PDF in a new tab.
- [LIVE-DB] Open `/etf/BTBETRETF`: confirm symbol and stored name, newest-first `ok` report rows only, Romanian headers/date/decimal format, and that the newest values/date match the home row.
- [AUTO-PARTIAL] Switch the detail page to EN and back. Confirm English headers, ISO dates, dot decimals, and unchanged stored ETF name.
- [LIVE-DB] Open `/etf/NOPE` in production and confirm a 404. Optionally compare the table’s dates with the SQL query in `US-018-qa.md`.
- [JUDGMENT] Confirm the drafted Romanian strings and defaults: separate history link, omitted missing days, and deactivated ETF detail pages remain reachable.

## Files changed

- `dev_minions/verification/US-018-qa-run.md`
- `dev_minions/status.md`
- `dev_minions/HANDOVER.md`
