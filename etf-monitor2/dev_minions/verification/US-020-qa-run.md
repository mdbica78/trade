## QA run 1 — 2026-09-26 12:53
Verdict: BLOCKED
Machine checks: 2/4 AUTO+AUTO-PARTIAL passed; 2 blocked by unrelated in-progress US-021 TypeScript errors.   Left for the user: 2

This QA run was explicitly requested by the user as an exception to the normal development-loop status gate.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Seed safety, ETF configuration, detection, admin actions/pages, boundaries, and bilingual rendering (AC1–AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm exec vitest run lib/db/seed.pglite.test.ts lib/config/etfs.test.ts lib/config/etfs.pglite.test.ts lib/config/detect-adapter.test.ts lib/config/boundaries.test.ts app/admin/layout.test.tsx app/admin/page.test.tsx app/admin/etfs/page.test.tsx app/admin/etfs/actions.test.ts app/admin/etfs/result-messages.test.ts components/admin/ActionMessage.test.tsx components/AppHeader.test.tsx i18n/messages.test.ts --reporter=dot --silent` → exit 0 → `Test Files 13 passed (13); Tests 119 passed (119)`. |
| 2 | Frozen dependency install | AUTO | PASS | `env -u DATABASE_URL pnpm install --frozen-lockfile` → exit 0 → `Lockfile is up to date, resolution step is skipped; Done in 463ms using pnpm v12.5.1`. |
| 3 | Project typecheck and full regression suite (AC11) | AUTO | BLOCKED | `env -u DATABASE_URL pnpm typecheck && env -u DATABASE_URL pnpm test -- --silent` → exit 1 at typecheck, before tests: `lib/config/tracked-fields.pglite.test.ts(149,12): error TS2571: Object is of type 'unknown'`; also at lines 167 and 288. This file belongs to in-progress US-021, not US-020. |
| 4 | Lint and local admin-page render (AC9, AC11) | AUTO-PARTIAL | BLOCKED | `env -u DATABASE_URL pnpm lint; env -u DATABASE_URL bash scripts/claude/qa-serve.sh start; ... stop` → shell exit 0, but the server script reports `BUILD FAILED` with the same three US-021 TypeScript errors; server stopped. Lint itself passed with 0 errors and three existing unused-parameter warnings. |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] After the typecheck blocker is resolved and the app is deployed, test `/admin/etfs`: add an unmonitored BVB ETF, verify the detection/unavailable marker, deactivate it, then reactivate it. Confirm it leaves/rejoins the home table and daily-job input.
- [LIVE-DB] Verify the safe seed re-run using the query and sequence in `US-020-qa.md`: existing admin changes, deactivation, removed tracked fields, and settings must remain unchanged.

### Blocker

- The shared working tree contains unfinished US-021 test code that makes `pnpm typecheck`, `pnpm build`, and therefore local admin rendering unavailable. Re-run this QA round after `lib/config/tracked-fields.pglite.test.ts` type errors at lines 149, 167, and 288 are resolved.

## QA run 2 - 2026-09-26

Verdict: PASS

The shared US-021 TypeScript errors recorded in run 1 have been resolved. This normal QA rerun was permitted by `scripts/claude/dev-loop-status.sh` returning `RUNNING 2026-09-26 13:51:30 - run 2` with exit 0.

| # | Check (source) | Type | Result | Evidence (command -> exit code -> output tail) |
|---|---|---|---|---|
| 1 | Project typecheck and full regression suite (AC11) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck && env -u DATABASE_URL pnpm test -- --silent` -> exit 0 -> `Test Files 79 passed (79); Tests 960 passed (960)`. The reported next-intl time-zone notices are test-render warnings, not test failures. |
| 2 | Lint (AC11) | AUTO | PASS | `env -u DATABASE_URL pnpm lint` -> exit 0 -> `0 errors, 3 warnings`; the warnings are existing unused test parameters in `default-deps.test.ts`, `types.test.ts`, and `load-etfs.test.ts`. |
| 3 | Production build (AC11) | AUTO | PASS | `env -u DATABASE_URL pnpm build` -> exit 0 -> webpack compiled successfully; TypeScript completed; routes include `/admin`, `/admin/etfs`, and `/admin/etfs/[symbol]/fields`. |
| 4 | Local admin render, Romanian and English (AC9, AC11) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL bash scripts/claude/qa-serve.sh start`; `get /admin`; `get /admin/etfs`; `get /admin/etfs NEXT_LOCALE=en`; `stop` -> exit 0 -> all three routes returned `STATUS 200`; `/admin` rendered translated navigation/ETF link; the no-database ETF pages rendered translated safe error states; `QA server stopped.` |

The focused US-020 evidence from run 1 remains valid: 119 seed/configuration/detection/admin/bilingual tests passed and the frozen install passed. Run 2 clears the only shared-project blockers; no US-020 failure was found.

### For the user (only what a machine couldn't settle)

- [LIVE-DB] After deployment, test `/admin/etfs`: add an unmonitored BVB ETF, verify the detection/unavailable marker, deactivate it, then reactivate it. Confirm it leaves/rejoins the home table and daily-job input.
- [LIVE-DB] Verify the safe seed re-run using the query and sequence in `US-020-qa.md`: existing admin changes, deactivation, removed tracked fields, and settings must remain unchanged.
