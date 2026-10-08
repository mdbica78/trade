# US-052 independent test verdict — Round 1

**Result: FAIL — AC6 NOT MET (baseline line counts unavailable).** All executable
test/build gates passed; AC1–AC5 are MET on this run. No source or test code was
changed by this test run.

## Environment and scope

Ran through WSL login Bash. Before every validation command, unset
`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`,
`GEMINI_API_KEY`, and `GROQ_API_KEY`; no variable values were printed.
No git, live service, migration, deploy, or QA command was run.

## Commands and results

Focused admin/configuration/UI suite:

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; set -o pipefail; pnpm exec vitest run --reporter=dot app/admin app/home-display-actions.pglite.test.ts app/load-error.boundary.test.ts lib/config lib/admin/operations lib/monitoring/history lib/monitoring/home components/admin components/HeaderNav.test.tsx components/ThemeToggle.test.tsx app/globals app/colour-literals.test.ts 2>&1 | tail -n 18"
```

Exit 0 — **56 test files, 516 tests passed** (131.42s).

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; pnpm typecheck"
```

Exit 0 — `tsc --noEmit`, no errors.

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; set -o pipefail; pnpm lint 2>&1 | tail -n 30"
```

Exit 0 — **0 errors, 11 warnings**. Warnings are unused parameters in
`app/health/page.failure.test.tsx`, `lib/ai/providers/timeout.test.ts`,
`lib/cron/default-deps.seam.test.ts`, `lib/cron/default-deps.test.ts`,
`lib/extraction/adapters/types.test.ts`, `lib/ingestion/ingest-etf.ts`
(2), and `lib/ingestion/load-etfs.test.ts`; all outside US-052's touched
source/test list.

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; set -o pipefail; pnpm test -- --reporter=dot 2>&1 | tail -n 30"
```

Exit 0 — **223 test files, 2,287 tests passed** (261.42s).

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; set -o pipefail; pnpm build 2>&1 | tail -n 35"
```

Exit 0 — offline production build succeeded; migration-on-deploy skipped
because this was not a production build; all 12 dynamic routes were listed.
The expected sanitized no-database log was
`[load-error] home name=MissingDatabaseUrlError`.

```text
wsl.exe -- bash -lc "cd /mnt/c/_mystaff/myG/trade/etf-monitor2; unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY; set -o pipefail; bash scripts/claude/predeploy-check.sh 2>&1 | tail -n 35"
```

Exit 0 — `PREDEPLOY: PASS — typecheck, lint, build and tests are green.`
The gate's full regression also reported 223 files / 2,287 tests passed.

**Resolved command-line issues (not product failures):** an initial focused
summary attempt using `--silent` without a value exited 1 with Vitest's
`Unexpected value "--silent=app/admin"` parser error; corrected with
`--silent=true` and then captured the final focused result using the command
above. An initial `pnpm test --reporter=dot` invocation exited 2 because pnpm
parsed `dot` as its own reporter option; the correct `pnpm test -- --reporter=dot`
command above passed.

The focused run emitted a PGlite `TT: undefined function: 32` warning and
next-intl `ENVIRONMENT_FALLBACK` warnings about an unconfigured time zone in
`OperationsDashboard` tests. They did not fail tests. No test is failing.

## Acceptance criteria mapped to independent evidence

- **AC1 — MET.** This run's typecheck, lint, full suite, offline build, and
  predeploy gate all passed. The full regression was 223/223 files and
  2,287/2,287 tests. The HANDOVER records these deliberate test changes and
  reasons:
  - `app/admin/page.test.tsx`: assert the allowed single `/admin` nav.
  - `app/admin/etfs/[symbol]/fields/actions.test.ts`: malformed direction now
    maps to the existing invalid-direction message.
  - `app/admin/cron/actions.test.ts`, `app/admin/cron/page.test.tsx`, and
    `app/home-display-actions.pglite.test.ts`: consolidated dependency factory
    names.
  - `app/admin/etfs/actions.test.ts`: ETF changes no longer revalidate `/admin`.
  - `app/globals.home-table.test.ts`: tabular numerals inherit from the body.
  - `lib/config/etfs.test.ts` and `lib/config/etfs.pglite.test.ts`: type-only
    narrowing of null discriminants in test fakes.
  - `app/load-error.boundary.test.ts` LB-E0–LB-E2: page-local catches/logging
    moved behind the tested scoped `loadOrError` wrapper.
  The focused admin/config tests and full suite passed.
- **AC2 — MET.** Focused admin actions and result-message tests passed,
  including ETF, AI, cron, and tracked-field action suites, plus
  `app/home-display-actions.pglite.test.ts`. No changed action/result behavior
  test failed.
- **AC3 — MET.** Focused admin page tests passed. `app/load-error.boundary.test.ts`
  LB-E0–LB-E5 passed; these check page handling through the scoped
  `loadOrError` wrapper or `logLoadError`, including the no-console and shared
  logger constraints.
- **AC4 — MET.** `components/admin/admin-markup.golden.test.tsx` passed for
  both EN and RO snapshots. Its render covers `HeaderNav`, `ThemeToggle`, and
  `TrackedFieldsAdmin`, and compares the serialized markup to the saved
  pre-refactor snapshots without update mode. `app/admin/page.test.tsx` also
  passed for the allowed single-navigation change.
- **AC5 — MET.** Focused CSS/token/contrast/color-literal tests passed:
  `app/globals.tokens.test.ts`, `app/globals.rules.test.ts`,
  `app/globals.contrast.test.ts`, `app/globals.home-table.test.ts`, and
  `app/colour-literals.test.ts`. The tracked-fields PGlite suite passed; its
  `untrackField` UT-1 assertion checks one runner call with one statement.
- **AC6 — NOT MET.** HANDOVER records each D-finding as done or skipped and
  records post-change line counts (3,412 lines total). It explicitly states
  that pre-edit line counts were not captured, so the required before/after
  comparison cannot be completed. The missing baseline cannot be reconstructed
  without prohibited version-control operations; this report records that
  limitation rather than inferring the values.

## Denied or attempted commands

None. No git command, secret-file read, live resource, migration, deploy, or QA
command was attempted.
