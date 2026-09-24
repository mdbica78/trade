## QA run 1 — 2026-09-24 16:29

Verdict: PASS
Machine checks: 9/9   Left for the user: 2

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | Fixture-backed discovery → PDF → text → adapter → tracked-value persistence path (AC1) | AUTO | PASS | Focused ingestion/PGlite suite passed 56/56. |
| 2 | Stored report date comes from the PDF footer, not filing metadata or clock (AC2) | AUTO | PASS | `ingest-etf.test.ts` passed in the focused 56/56 run. |
| 3 | Only tracked fields persist; incomplete/unknown tracked values write nothing; zero tracking is valid (AC3) | AUTO | PASS | `select-values.test.ts` and pipeline tests passed in the focused 56/56 run. |
| 4 | Report and values are atomic; no `ok` row can survive without its values (AC4) | AUTO | PASS | `store.pglite.test.ts` passed in the focused 56/56 run. |
| 5 | Existing `ok` rows remain untouched; non-`ok` rows are replaced; repeat run is idempotent (AC5) | AUTO | PASS | Fake-store and PGlite rerun tests passed in the focused 56/56 run. |
| 6 | One discovery/download attempt at most and all throws become failure outcomes (AC6) | AUTO | PASS | `ingest-etf.test.ts` passed in the focused 56/56 run. |
| 7 | Every listed failure path writes nothing and names its stage/message (AC7) | AUTO | PASS | Parameterized failure-path tests passed in the focused 56/56 run. |
| 8 | Ingestion boundaries exclude UI/Next/AI and all tests avoid live Neon/network access (AC8) | AUTO | PASS | `boundaries.test.ts` and injected/mocked I/O tests passed in the focused 56/56 run. |
| 9 | Typecheck, lint and production build succeed without `DATABASE_URL` (AC9) | AUTO | PASS | `pnpm typecheck` exit 0; `pnpm lint` exit 0 (one known unused test-parameter warning); retry `pnpm build` exit 0 after a transient concurrent-build lock cleared. |

### For the user (only what a machine couldn't settle)

- [JUDGMENT] Keep the implemented literal-FR3 rule of storing tracked fields only, or change future scope to store every field an adapter extracts?
- [JUDGMENT] Keep newest-link-only handling for a multi-report BVB filing, or add a follow-up to ingest every link in the newest filing row?

