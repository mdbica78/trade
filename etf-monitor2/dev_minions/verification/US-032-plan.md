# US-032 plan (planned inline, ≤15 lines, simple story)

- AC1/AC2/AC3 → `app/health/page.tsx`: replace the `"timedOut" in status ? … : …` ternary (current, unverified TL patch)
  with a `failureText(status, t)` helper taking the `!dbConnected` branch of `HealthStatus`, a `switch` on
  `"timedOut" in status`, default branch `const _exhaustive: never = status; throw ...` so a new `HealthStatus` member
  fails `pnpm typecheck`. Call it from the JSX in place of the ternary. Proven by existing `HP-F1`/`HP-F2` (ro/en)
  in `app/health/page.failure.test.tsx` — unchanged expectations, must still pass.
- AC3 extra: add one type-level test in `page.failure.test.tsx` (e.g. `expectTypeOf` or a compile-only helper call)
  asserting `failureText` is exported and total over `HealthStatus`'s failure members — export `failureText` from
  `page.tsx` for the test to import.
- AC4 → Task 2 cross-check: grep each headline symbol from US-029/030/031 "Files changed" (non-test/source+message
  files) and write the table into `dev_minions/verification/US-032-tests.md`.
- AC5 → run `pnpm typecheck && pnpm lint && pnpm build && pnpm test` with `DATABASE_URL`, `CRON_SECRET`,
  `GEMINI_API_KEY`, `GROQ_API_KEY` unset; quote command/exit/tail. CPS-1 / PGlite-hook timeouts logged as US-034's,
  re-run alone and quoted.

Files: `app/health/page.tsx` (edit), `app/health/page.failure.test.tsx` (edit, add AC3 test),
`dev_minions/verification/US-032-tests.md` (new), `dev_minions/verification/US-032-review.md`,
`US-032-tests.md` verdict, `US-032-qa.md` (later).

## Fix strategy — round 3
> story-planner, 2026-09-28. Scope: AC4 only (AC1-AC3, AC5 unchanged, no code change this round).

Full strategy: `dev_minions/verification/US-032-fix-strategy-round3.md`. In short: the AC4 table is generated
by script from HANDOVER.md's three `## Files changed (US-029/030/031 …)` sections, one row per (story, file,
annotation token). Exclusions are decided by path only: X1 test files, X2 `dev_minions/verification/`, X3
paths that are only referenced (2 expected, each quoted). Two `comm` set differences must print nothing:
every in-scope (story, file) pair has a row, and every annotation token has a row. Message-key paths are
proven with `node`. The conclusion line cites only quoted counts. The tester's Round 1 verdict section in
`US-032-tests.md` is not edited.
