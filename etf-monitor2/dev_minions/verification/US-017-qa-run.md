# US-017 — Codex QA run

**Run:** 1  
**Date:** 2026-09-25 16:22  
**Verdict:** PASS — all automated and auto-partial checks passed. One production-data calculation and three non-blocking product/copy confirmations remain for the user.

## Evidence

| Check | Classification | Result | Evidence |
| --- | --- | --- | --- |
| AC1–AC6 focused exact-arithmetic, formatting, PGlite read-model, component, page, and message tests | Auto | PASS | Focused Vitest run completed: 7 files, 84 tests. It covered bigint delta arithmetic, half-away-from-zero percentage rounding, calendar boundaries, no-guess gaps, localized rendering, and message parity. |
| AC7/AC8 typecheck and full regression suite | Auto | PASS | `pnpm typecheck` and `pnpm test -- --silent` completed with `DATABASE_URL` unset: 56 files, 744 tests passed. |
| Lint | Auto | PASS | `pnpm lint` exited 0. Only the three known unused test-helper/type parameters remain warnings: `_deps`, `_text`, `_statements`. |
| Offline production build | Auto | PASS | `pnpm build` completed with `DATABASE_URL` unset; `/` is reported dynamic/server-rendered on demand. |
| Romanian local home route | Auto | PASS | Required `qa-serve.sh` returned HTTP 200 for `/` without a database and rendered only the Romanian generic error state. |
| English local home route | Auto-partial | PASS | Required `qa-serve.sh` returned HTTP 200 for `/` with `NEXT_LOCALE=en` and rendered only the English generic error state. Cookie-driven locale rendering passed; a visible switcher click is included below. |
| Server cleanup | Auto | PASS | `qa-serve.sh stop` completed after the smoke checks. |

## User checks still needed

- [LIVE-DB] After deploying, choose an ETF and a tracked field for which Neon has `ok` reports on two consecutive calendar days. Compare the home-table absolute delta with the two linked PDFs, then verify `(current - previous) / |previous| × 100`, rounded to two decimals, in both RO and EN.
- [AUTO-PARTIAL] Click the visible RO/EN language switcher and back. Confirm localized delta decimal marks, explicit signs, and percent symbols; cookie-selected render paths passed automatically.
- [JUDGMENT] Confirm the drafted Romanian title labels for absolute and percentage change.
- [JUDGMENT] Confirm the non-blocking defaults: previous means the literal prior calendar day (a missing day gives a blank delta), and display is signed with two-decimal percentage, no colour.

## Files changed

- `dev_minions/verification/US-017-qa-run.md`
- `dev_minions/status.md`
- `dev_minions/HANDOVER.md`
