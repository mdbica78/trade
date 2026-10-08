## QA run 1 — 2026-10-05 15:36
Verdict: PASS — with the PO-approved AC6 evidence exception in DEC-024.
Machine checks: 7/7 AUTO and AUTO-PARTIAL passed. Left for the user: 2.

This run used no database, cron, deployment, master-key, or provider-key
variables in the check processes. No variable value was printed. Commands
below were run in the project through `bash -lc` with `env -u DATABASE_URL
-u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY
-u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY` before `pnpm`.
Neither snapshot update mode nor a production migration was used.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → lockfile up to date, install completed. |
| 2 | Focused admin/config/PGlite/golden/CSS regression (AC2–AC5, qa.md #2/#4) | AUTO | PASS | Initial focused run → 0 → `Test Files 56 passed (56); Tests 516 passed (516)` (the initial selector was not retained in this report, so the reproducible focused rerun is the evidence used here): `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run components/admin/admin-markup.golden.test.tsx app/admin/page.test.tsx app/admin/etfs/actions.test.ts app/admin/etfs/\[symbol\]/fields/actions.test.ts lib/config/tracked-fields.pglite.test.ts app/globals.home-table.test.ts app/load-error.boundary.test.ts'` → 0 → `Test Files 7 passed (7); Tests 58 passed (58)`. Golden snapshot matched without `-u`; MV-U1 rejects malformed direction with zero runner calls; UT-1 preserves report data. A next-intl timezone fallback warning occurred in the page test, but the test passed. |
| 3 | Typecheck (AC1, qa.md #1) | AUTO | PASS | `pnpm typecheck` → 0 → TypeScript completed without errors. |
| 4 | Lint (AC1, qa.md #1) | AUTO | PASS | `pnpm lint` → 0 → `11 problems (0 errors, 11 warnings)`. |
| 5 | Full regression (AC1, qa.md #1) | AUTO | PASS | `pnpm test -- --reporter=dot` → 0 → `Test Files 223 passed (223); Tests 2287 passed (2287)`. |
| 6 | Offline production build (AC1, qa.md #1) | AUTO | PASS | `pnpm build` → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes generated. |
| 7 | Served RO/EN no-database routes, single admin navigation (AC3–AC4, qa.md #3) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh start` → 0 → server ready on `127.0.0.1:3100` with no database. `bash scripts/claude/qa-serve.sh get <route> NEXT_LOCALE=<ro or en>` → 0 and `STATUS 200` for each of `/`, `/etf/BTBETRETF`, `/admin`, `/admin/etfs`, `/admin/ai`, `/admin/cron`, `/admin/operations`, `/admin/etfs/BTBETRETF/fields`, `/chat` (18 requests). Browser `/admin` in Romanian and English showed one admin-section navigation with ETFs, AI, Daily job and Operations, and a translated intro. No raw exception or secret was observed in these no-DB pages. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` |

### Evidence limitation (AC6)

The independent `US-052-review.md` and `US-052-tests.md` Round 1 verdicts
both remain FAIL on AC6, specifically because the pre-edit `wc -l` counts
were not recorded. DEC-024 records the user's acceptance of this missing
baseline and authorization to proceed to QA. This QA PASS is **not** a
retroactive proof of AC6: no before/after line reduction is claimed, and
the independent verdicts are unchanged. All executable and served-app
checks above passed under that explicit exception.

### For the user

- [JUDGMENT] Compare the normally populated RO/EN home, detail, admin,
  and chat pages against the previous appearance. The no-DB routes and
  unchanged golden markup passed; populated pages were not available here.
- [LIVE-DB] If a tracked field is present after an ordinary push, check
  that a malformed move direction shows the existing localized
  invalid-direction message. Offline action/PGlite tests passed, but the
  no-DB page had no tracked-field row for a browser interaction.

No live Neon, BVB, Vercel, stored key, AI provider, migration, deployment,
or git command was used. Files changed by QA: this report, only the US-052
row in `dev_minions/status.md`, and a QA/Deploy log append in
`dev_minions/HANDOVER.md`. Denied or attempted commands: none.
