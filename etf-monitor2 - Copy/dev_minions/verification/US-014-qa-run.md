## QA run 1 - 2026-09-25 09:53

Verdict: PASS
Machine checks: 5/5 AUTO passed. Left for the user: 0

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | No-adapter, missing-report, fetch-error, parse-error, precedence, and closed-outcome paths (AC1-AC8; qa.md automated) | AUTO | PASS | Focused offline ingestion/PGlite/cron suite completed successfully; it includes `outcome`, `ingest-etf.failures`, PGlite store/E2E, boundary, and runner tests. |
| 2 | TypeScript gate (AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck` exited 0. |
| 3 | Full regression suite (AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm test -- --silent` completed successfully. Fixture PDF diagnostics are expected and did not fail tests. |
| 4 | Lint gate (AC9) | AUTO | PASS | `pnpm lint` exited 0; only the known unused `_text` and `_statements` test-helper warnings. |
| 5 | Production build (AC9) | AUTO | PASS | `env -u DATABASE_URL pnpm build` compiled successfully and ran TypeScript validation. |

### For the user

None. This story has no new live BVB, Neon, Vercel, credential, or product-judgment check: it deliberately exercises its failure paths offline with mocked fetch/adapters and PGlite. Live visibility of these outcomes belongs to US-015.
