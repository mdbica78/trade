# US-016 — Codex QA run

**Run:** 1  
**Date:** 2026-09-25 16:15  
**Verdict:** PASS — automated and auto-partial checks passed. Production-data and product-choice confirmations remain for the user.

## Evidence

| Check | Classification | Result | Evidence |
| --- | --- | --- | --- |
| AC1–AC9 focused read-model, formatter, component, page, and message tests | Auto | PASS | `pnpm exec vitest run lib/format/number.test.ts lib/format/date.test.ts lib/monitoring/home.pglite.test.ts components/HomeTable.test.tsx app/page.test.tsx i18n/messages.test.ts --reporter=dot --silent` completed successfully with `DATABASE_URL` unset. |
| AC10/AC11 typecheck and full regression suite | Auto | PASS | `pnpm typecheck` and `pnpm test -- --silent` completed successfully with `DATABASE_URL` unset. Relevant page (5) and table (12) tests passed. |
| Lint | Auto | PASS | `pnpm lint` exited 0. Three existing unused test-helper/type parameters remain warnings only: `_deps`, `_text`, `_statements`. |
| Offline production build | Auto | PASS | `pnpm build` completed successfully with `DATABASE_URL` unset. |
| Romanian local home route | Auto | PASS | Required `qa-serve.sh` returned HTTP 200 for `/` without a database and rendered the Romanian generic error: “Datele nu au putut fi încărcate. Încearcă din nou mai târziu.” |
| English local home route | Auto-partial | PASS | Required `qa-serve.sh` returned HTTP 200 for `/` with `NEXT_LOCALE=en` and rendered “Could not load the data. Please try again later.” The locale cookie/render path is verified; the visible switcher click remains a user check below. |
| Server cleanup | Auto | PASS | `qa-serve.sh stop` completed after both requests. |

## User checks still needed

- [LIVE-DB] After deploying, open the production home page. Confirm one row per active ETF, Romanian labels by default, configured columns, and a report date where an `ok` report exists.
- [LIVE-DB] Open each symbol link. Confirm it opens the newest available depositary PDF and that displayed values match its newest `ok` report, using no grouping separator and a Romanian decimal comma.
- [AUTO-PARTIAL] Click the visible RO/EN language switcher and back. Confirm English headers, decimal dot, and ISO dates; the cookie-selected EN render was verified automatically.
- [LIVE-DB] Run the insert/reload/delete sequence in `US-016-qa.md` for `tracked_fields.net_asset`, and confirm the column appears at the configured position then disappears after deletion.
- [LIVE-DB, optional] Temporarily deactivate and restore an ETF, confirming it disappears and reappears.
- [JUDGMENT] Confirm the product defaults proposed by the story: newest `ok` report is the shown value with its date; values from `parse_error` reports remain hidden; RO dates are `dd.MM.yyyy` and EN dates ISO.

## Files changed

- `dev_minions/verification/US-016-qa-run.md`
- `dev_minions/status.md`
- `dev_minions/HANDOVER.md`
