# US-063 — QA checklist (job-runs table scrolls)

Review: PASS (round 1, `US-063-review.md`). Tests: PASS (round 1, `US-063-tests.md`, 260 files / 2814 tests, typecheck, lint 0 errors, offline build). Codex QA not yet run.

## Offline commands (no live resource)
`corepack pnpm typecheck`, `lint`, `test`, `build` with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/key variables unset; focused: `components/admin/OperationsDashboard.test.tsx` (OD-SC1, OD-SC2), `app/globals.contrast.test.ts`.

## MANUAL-QA (browser; needs a database with more than ~10 job runs)
1. `/admin/operations` (RO and EN): the run-history table is at most about 24rem tall and scrolls vertically; the page itself does not grow with the run count. (AC1)
2. The header row stays visible while scrolling and keeps a visible divider on its bottom edge (reviewer Warning W2: `border-collapse` can drop it). Cosmetic only; report if it looks wrong. (AC1)
3. At ~375 px width the wide log column scrolls horizontally inside the region, not the page. (AC2)
4. Tab to the region: a visible focus ring appears; arrow keys / Page Down scroll it. Repeat in the light and dark themes. (AC3)
5. Screen reader (or accessibility tree) announces the region label: EN "Job runs" style label / RO equivalent from `Admin.operations.runsScrollLabel`. (AC3)

## Deliberate markup change
The run-history table is wrapped in a focusable scroll region with sticky header cells (`max-h-96 overflow-auto`, `role="region"`, `tabIndex=0`, `data-runs-scroll`). No snapshot includes this component; no snapshot was regenerated.

## Files changed
`components/admin/OperationsDashboard.tsx`, `components/admin/OperationsDashboard.test.tsx` (OD-SC1, OD-SC2), `messages/en.json`, `messages/ro.json` (`Admin.operations.runsScrollLabel`), `dev_minions/verification/US-063-plan.md`, `US-063-review.md`, `US-063-tests.md`, `US-063-qa.md`, `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
