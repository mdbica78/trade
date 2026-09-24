## QA run 1 — 2026-09-24 16:21

Verdict: PASS
Machine checks: 7/7   Left for the user: 0

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | Exported adapter contract has the required discriminated shapes and compile-time guards (AC1) | AUTO | PASS | Focused adapter test suite passed 94/94; `pnpm typecheck` exit 0. |
| 2 | Exact registry lookup returns only the registered adapter and never falls back (AC2) | AUTO | PASS | `registry.test.ts` passed in the focused 94/94 run. |
| 3 | Duplicate adapter keys are rejected with a clear error (AC3) | AUTO | PASS | `registry.test.ts` passed in the focused 94/94 run. |
| 4 | Detection returns only a single unambiguous claimant and checks every adapter (AC4) | AUTO | PASS | `registry.test.ts` passed in the focused 94/94 run. |
| 5 | Extraction-result validation reports every required contract violation (AC5) | AUTO | PASS | `validate.test.ts` passed in the focused 94/94 run. |
| 6 | Adapter modules remain text-only and do not import DB, network or PDF code (AC6) | AUTO | PASS | `boundaries.test.ts` passed in the focused 94/94 run. |
| 7 | Typecheck, lint and production build succeed without `DATABASE_URL` (AC7) | AUTO | PASS | `pnpm typecheck` exit 0; `pnpm lint` exit 0 (one known unused test-parameter warning); `pnpm build` exit 0. |

### For the user (only what a machine couldn't settle)

- None. This story has no MANUAL-QA, live-service or user-judgment item.

