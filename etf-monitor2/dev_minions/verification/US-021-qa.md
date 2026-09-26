# US-021 QA checklist — Admin: tracked-field management per ETF

Round 1: review PASS, tests PASS (`US-021-review.md`, `US-021-tests.md`). All 9 acceptance
criteria drafted by agent (story-planner) — **PO to confirm** at the demo.

## Automated (already run this round, offline/PGlite only)
- `pnpm typecheck` — pass
- `pnpm lint` — pass (3 pre-existing warnings, unrelated)
- `pnpm test` — 960 passed / 960 (79 test files; 60 of them new or extended for this story)
- `env -u DATABASE_URL pnpm build` — pass (new route `/admin/etfs/[symbol]/fields` present)

## Manual / live checks (for the user or the Codex QA loop, per AGENTS.md)
Codex can serve the app locally (`scripts/claude/qa-serve.sh`) and confirm
`/admin/etfs/<SYMBOL>/fields` shows a translated error (not a crash/stack trace) when
`DATABASE_URL` is unset — no live resource needed for that part (MQ-4).

The checks below need the deployed app with Neon (sprint-05.md "Manual QA" steps 1 and 3, **yours to run**):

1. **Track / move / untrack, live (MQ-1).** Open `/admin/etfs`, follow BTBETRETF's "Fields" link.
   Track "Activ net" and move it to the top. Reload `/` — an "Activ net" column appears, empty for
   BTBETRETF until the next daily run (this is correct: FR4.2, no backfill). Untrack it — the
   column disappears (unless another active ETF still tracks it). In the Neon SQL editor:
   `select count(*) from report_values rv join reports r on r.id = rv.report_id join etfs e on e.id = r.etf_id where e.symbol='BTBETRETF' and rv.field_key='net_asset';`
   — the count is the same before and after the untrack (history is never deleted with the column).
2. **Re-seed safety (MQ-2, ties to US-020's AC1).** Untrack one seeded field (e.g. BTBETRETF
   `units_in_circulation`). Run `DATABASE_URL=<neon-url> pnpm db:seed` locally.
   `select * from tracked_fields order by etf_id, display_order;` — the removed field did not come
   back, other orders unchanged.
3. **Next daily run (MQ-3).** After the next scheduled cron run, a field tracked in step 1 (if left
   tracked) shows a value on `/`, and the new `job_runs` row lists BTBETRETF `ok` (not `parse_error`
   — only available fields can be tracked, so a tracked field is always extractable).

## PO to confirm
- All 9 acceptance criteria in `dev_minions/backlog/stories/US-021.md` (drafted by agent).
- Sprint-05 decisions #7 (available = catalogue ∩ adapter fieldKeys) and #8 (order stays per ETF,
  new field goes last) — both Decided/defaulted, listed in HANDOVER.md "Waiting on the user" if a
  question remains open.

## Notes for QA / the user
- Review round 1 recorded two non-blocking findings (`US-021-review.md`): W1 — the AC9 test table
  names a source-scan test "FA-5" but no such scan exists in `actions.test.ts` (the file itself was
  manually confirmed clean; same pre-existing gap as US-020's `actions.test.ts`); N1 — `trackField`
  makes up to 3 `BatchRunner` calls instead of the plan's 2 (functionally safe, proven by TR-5/TR-6,
  but an extra round-trip). Neither blocks this round; no story reopened.

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed" for US-021 (copied there at round 1 close).
