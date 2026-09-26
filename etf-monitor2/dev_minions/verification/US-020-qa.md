# US-020 QA checklist — Admin: ETF management (add, remove, activate)

Round 1: review PASS, tests PASS (`US-020-review.md`, `US-020-tests.md`). All 11 acceptance
criteria drafted by agent (story-planner) — **PO to confirm** at the demo.

## Automated (already run this round, offline/PGlite only)
- `pnpm typecheck` — pass
- `pnpm lint` — pass (3 pre-existing warnings, unrelated)
- `pnpm test` — 901 passed / 901 (108 of them new to this story)
- `env -u DATABASE_URL pnpm build` — pass

## Manual / live checks (for the user or the Codex QA loop, per AGENTS.md)
Codex can serve the app locally (`scripts/claude/qa-serve.sh`) and confirm each admin page shows a
translated error (not a crash) when `DATABASE_URL` is unset — no live resource needed for that part.
The checks below need the deployed app with Neon (sprint-05.md "Manual QA" steps 1–2, **yours to run**):

1. **Seed re-run safety (AC1).** In the Neon SQL editor: `select symbol, name, is_active from etfs; select * from tracked_fields; select * from settings;`. In `/admin/etfs`, deactivate one ETF (and, once US-021 ships, remove one tracked field). Run `DATABASE_URL=<neon-url> pnpm db:seed` locally. Re-run the three queries — expected: the deactivated ETF is still inactive, `settings` unchanged, no removed tracked field came back.
2. **Add / detect / remove / reactivate (AC2–AC6).** Open `https://<your-app>.vercel.app/admin/etfs`. Add a real BVB ETF not yet monitored (e.g. `ICBETNETF`). Expected: listed, adapter shows "not registered"/"none" (no adapter matches its format), home table shows "extraction unavailable". Remove it — disappears from the home table and from the next `job_runs.log`. Add the same symbol again — expected: reactivated (same id/history), not a duplicate error.
3. **Manual adapter override / re-detect (AC7).** For an ETF with a registered adapter, set it to "none" via the select, save, confirm the home table now shows it unavailable; re-detect and confirm it picks the adapter back up.

## PO to confirm
- All 11 acceptance criteria in `dev_minions/backlog/stories/US-020.md` (drafted by agent).
- Sprint-05 decisions #4, #5, #6 (soft removal, add-form inputs/no live BVB check, new ETF tracks nothing) — defaults shipped, listed in HANDOVER.md "Waiting on the user".

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed" for US-020 (copied there at round 1 close).
