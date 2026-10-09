# US-032 — QA checklist

Story: `dev_minions/backlog/stories/US-032.md`. Both independent gates PASS:
review round 3 (`US-032-review.md`), tests round 1 (`US-032-tests.md`).

## Automated (re-run by Codex QA)
1. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck` — expect exit 0.
2. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm lint` — expect exit 0, 0 errors.
3. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` — expect exit 0, `/health` route included.
4. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test` — expect all pass (1684+ tests). A `CPS-1` or PGlite-hook-only timeout under concurrent load is a known US-034 item — isolate and re-run that file alone, record separately, not a US-032 failure.
5. `npx vitest run app/health/page.failure.test.tsx` — expect 5/5 (HP-F1 ro/en, HP-F2 ro/en, HP-F3).

## Manual (live, for the user)
- After pushing: confirm the Vercel build finishes (this story's original trigger — the TS2339 build error is fixed by `app/health/failure-text.ts`'s exhaustive `failureText`).
- Open the deployed `/health` page: with the database reachable it shows the connected state; no agent can produce the live timeout/error states to demo them locally (deferred to actual deploy behaviour, already covered by US-031's live check).

## For the user
- PO to confirm the agent-drafted acceptance criteria (AC1–AC5) against the story.
- Nothing else — Task 2's cross-check found 0 discrepancies (108/108 rows present, independently re-derived and spot-checked by two separate reviewer passes).

## Files changed (US-032, final)
- `dev_minions/verification/US-032-plan.md` (new), `US-032-review.md` (rounds 1-3), `US-032-tests.md` (Task 2 cross-check, rounds 1-3), `US-032-fix-strategy-round3.md` (story-planner), `US-032-qa.md` (this file, new)
- new: `app/health/failure-text.ts`
- changed: `app/health/page.tsx` (`failureText` import replaces the unverified ternary), `app/health/page.failure.test.tsx` (+HP-F3)
