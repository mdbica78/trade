# US-023 QA checklist — Admin: cron hour setting

Round 1: review PASS (`US-023-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-023-tests.md`). All 9 acceptance criteria drafted by agent (story-planner) — **PO to
confirm** at the demo.

## Automated (already run this round, offline/PGlite only)
- `pnpm typecheck` — pass
- `pnpm lint` — pass (3 pre-existing warnings, unrelated)
- `pnpm test` — 1078 passed / 1078 (93 test files; 92 of them new or modified for this story)
- `env -u DATABASE_URL pnpm build` — pass (new route `/admin/cron` present, confirming `vercel.json`
  is embedded at build time with no `fs` read and no `DATABASE_URL`)

## Manual / live checks (for the user or the Codex QA loop, per AGENTS.md)
Codex can serve the app locally (`scripts/claude/qa-serve.sh`) and confirm `/admin/cron` shows the
effective window `10:00–10:59 UTC`, the translated load error in place of the form when
`DATABASE_URL` is unset, the Hobby note, and no stack trace (MQ-2). Never print an environment
value while doing this (DEC-015).

The check below needs the deployed app with Neon and Vercel (sprint-05.md "Manual QA" step 5,
**yours to run**):

1. **Change the hour end to end (MQ-1).** Open `/admin/cron` — the effective line reads
   `10:00–10:59 UTC`. Choose an hour other than 10, save — expect a success message and a notice
   with the exact `vercel.json` line to paste in. In the Neon SQL editor:
   `select ai_provider, ai_model, cron_hour_utc, default_locale from settings;` — only
   `cron_hour_utc` changed. Edit `vercel.json` with the shown line, commit, push, wait for the
   Production deployment. In Vercel → project → Settings → Cron Jobs, confirm the new schedule.
   Reload `/admin/cron` — the effective window now matches the desired hour and the notice is
   gone. The next `job_runs.started_at` falls inside the new UTC hour.

## PO to confirm
- All 9 acceptance criteria in `dev_minions/backlog/stories/US-023.md` (drafted by agent).
- Sprint-05 decision #11: the technical part (effective schedule read from the bundled
  `vercel.json`, the cron route never reads `cron_hour_utc`) is Decided. The product part — store
  the desired hour and show the exact `vercel.json` line, effective only after the user's commit
  and Production deployment — ships as the isolated default, listed in HANDOVER.md "Waiting on the
  user". An automatic path (Vercel API/deploy hook) would need a Vercel credential and its own
  decision.

## Notes for QA / the user
- Review round 1 recorded one non-blocking finding (`US-023-review.md`): W1 — the plan named a
  `CG-6b` test (`createCronConfigDeps`/`getDb` throwing) that was not written, and the implemented
  `CA-4b` restates `CA-4` instead of isolating the deps-factory-throws path. AC8 is still MET
  because production code wraps `getDb`, `createCronConfigDeps` and the config-layer call in one
  `try` block already exercised by `CG-6`/`CA-4`. Coverage gap versus the plan's own list, not a
  criterion failure. No story reopened.
- `vercel.json` itself was not edited by this story (by design — no agent deploys or runs git).
- Sprint 3's fixed-schedule-value test in `lib/cron/vercel-config.test.ts` was removed, per Sprint
  3 decision 3's own "before US-023 makes the hour adjustable" wording; the shape/one-entry/
  no-extra-key/README assertions in that file are unchanged.

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed" for US-023 (copied there at round 1 close).
