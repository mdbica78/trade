## QA run 1 - 2026-09-26

Verdict: PASS

The normal development-loop gate passed before this run: `bash scripts/claude/dev-loop-status.sh` -> exit 0 -> `RUNNING 2026-09-26 13:51:30 - run 2`.

| # | Check (source) | Type | Result | Evidence (command -> exit code -> output tail) |
|---|---|---|---|---|
| 1 | Tracked-field configuration, action, page, boundary, ETF-link, and i18n checks (AC1-AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm exec vitest run lib/config/tracked-fields.pglite.test.ts lib/config/tracked-fields.test.ts lib/config/boundaries.test.ts "app/admin/etfs/[symbol]/fields" app/admin/etfs/page.test.tsx i18n/messages.test.ts --reporter=dot --silent` -> exit 0 -> `Test Files 8 passed (8); Tests 77 passed (77)`. |
| 2 | Project typecheck and complete regression suite (AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck && env -u DATABASE_URL pnpm test -- --silent` -> exit 0 -> `Test Files 79 passed (79); Tests 960 passed (960)`. The next-intl time-zone notices are warnings emitted while rendering tests, not failures. |
| 3 | Lint and production build (AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm lint` -> exit 0 -> `0 errors, 3 warnings` (existing unused test parameters); `env -u DATABASE_URL pnpm build` -> exit 0 -> production build completed and listed `/admin/etfs/[symbol]/fields`. |
| 4 | Local Fields page without database, Romanian and English (MQ-4) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL bash scripts/claude/qa-serve.sh start`; `get /admin/etfs/BTBETRETF/fields`; `get /admin/etfs/BTBETRETF/fields NEXT_LOCALE=en`; `stop` -> exit 0 -> both responses were `STATUS 200` and rendered only translated safe load-error states; `QA server stopped.` |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] On deployed Neon, open BTBETRETF Fields; track `Activ net`, move it to the top, then untrack it. Confirm the home-table column changes accordingly and the existing `report_values` count for `net_asset` is unchanged.
- [LIVE-DB] Untrack one seeded field, run the safe seed command, and confirm the field did not return and orders remain unchanged.
- [LIVE-CRON] After the next scheduled job, confirm a newly tracked available field is populated and the `job_runs` entry is `ok`, not `parse_error`.

No US-021 failure was found. The page’s no-database response is expected for this offline QA environment and does not expose error details.
