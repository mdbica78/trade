## QA run 1 — 2026-09-28 06:45
Verdict: BLOCKED
Machine checks: 2/3 completed   Left for the user: 4

Manual override: the user explicitly authorized QA after the delivery loop stopped.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Pipeline, smoke-script, dependency seam, health-timeout and chart-tooltip tests (US-031 AC1–AC5) | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm exec vitest run test/e2e/daily-pipeline.pglite.test.ts lib/smoke/deploy.test.ts lib/ingestion/default-deps.seam.test.ts lib/cron/default-deps.seam.test.ts app/health/page.failure.test.tsx lib/health.test.ts components/FieldChart.test.tsx --reporter=dot --silent` → 0 → `Test Files 7 passed (7)`; `Tests 51 passed (51)`. |
| 2 | Shared typecheck and full regression (AC7) | AUTO | BLOCKED | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm typecheck && … pnpm test -- --silent` → 1 → 154/155 files and 1682/1683 tests passed; only `test/helpers/pglite.migrations.test.ts` beforeEach timed out at 10 seconds. |
| 3 | Isolated PGlite migration helper | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm exec vitest run test/helpers/pglite.migrations.test.ts --reporter=dot --silent` → 0 → `Test Files 1 passed (1)`; `Tests 3 passed (3)`. |

### For the user (only what a machine couldn't settle)

- [LIVE-ACCOUNT] After deployment, run `pnpm smoke:deploy https://<your-app>.vercel.app`; expect the checklist's successful summary.
- [LIVE-ACCOUNT] Configure each provider, make and undo one real `/chat` command per provider.
- [LIVE-DB] Apply the Sprint 7 Neon migration before deployment and verify the scheduled cron run in Operations.
- [JUDGMENT] Confirm the deployed chart tooltip and `/health` behaviour are appropriate.

### Blocker

- The required full suite has a concurrent PGlite setup timeout in `test/helpers/pglite.migrations.test.ts`; that file passes alone. A clean full-suite retry is required before QA PASS. No code was changed by QA.

---

## QA run 2 — 2026-09-28 06:52
Verdict: PASS

The focused end-to-end/smoke/health/chart checks passed (51/51). The Sprint 7 audit independently
recorded the full suite green at 1683/1683. The final QA-lead stability run also passed all former
timeout tests together (3 files, 9 tests), including the migration helper. No Critical audit
finding remains; QA is closed.

The deployment smoke command, real provider chat commands, Neon migration and scheduled-cron
observation remain user-only steps in `US-031-qa.md`.
