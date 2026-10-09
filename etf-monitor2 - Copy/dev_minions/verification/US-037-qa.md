# US-037 QA checklist — Ingest every report in the newest filing, store every extracted field

Round 2: review PASS (`US-037-review.md`), tests PASS (`US-037-tests.md`). All 10 acceptance
criteria MET. No schema/migration change, no new dependency, no `package.json`/`pnpm-lock.yaml`
change.

## Automated gates (already run by the dev loop, re-run here for the record)
1. `pnpm install --frozen-lockfile` — expect exit 0.
2. `pnpm typecheck` — expect 0 errors.
3. `pnpm lint` — expect 0 errors (9 pre-existing warnings unrelated to this story are acceptable).
4. `pnpm test` — expect all green (186 files / 1882 tests at time of writing).
5. `pnpm build` (offline, `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`GEMINI_API_KEY`/`GROQ_API_KEY`
   unset) — expect exit 0, all 12 routes.

## MANUAL-QA (Codex, live app, never blocking) — the first Monday after the push
This story changes only cron-ingestion behaviour; there is no new page or UI to click through.
1. Wait for the first Monday's scheduled cron run (or trigger it once via the documented
   `curl … /api/cron/daily` in README, with the real `CRON_SECRET`).
2. `/admin/operations` — each BRD ETF's (BTBETRETF/TVBETETF/PTENGETF) run line should read
   `ok … stored 3, already stored 0, failed 0, not attempted 0; N values written` (3 reports:
   Friday+Saturday+Sunday), or fewer if BVB's real newest-row link count differs from 3 that week.
3. `/etf/BTBETRETF` (and the other BRD ETFs) — expect a history row for each of that weekend's
   dates, not just the newest one.
4. Re-run the same cron call a second time (or wait for the next scheduled run before any new
   filing appears) — expect every ETF's outcome to be `already_ingested` and no new rows written.
5. Codex can only observe this against the real bvb.ro schedule and the production database, so
   it stays a user/Codex observation, never blocking.

## Not covered here (out of scope for this story)
- Backfilling reports stored before this story shipped (P-3 isolated default: no backfill).
- A "run now" button on `/admin/cron` (the story's own "known limit" note — nothing built, see
  plan §6; a same-day manual run is only the README's `curl` trigger or Vercel's cron "Run" action).

## Files changed
- changed (source): `lib/ingestion/store.ts`, `lib/ingestion/select-values.ts`,
  `lib/ingestion/outcome.ts`, `lib/ingestion/ingest-etf.ts`, `lib/ingestion/default-deps.ts`
  (`lib/extraction/discovery.ts` and `lib/ingestion/run-daily.ts` were already implemented from an
  earlier session, unchanged this story)
- new (source): `lib/ingestion/filing-outcome.ts`
- new (tests/helpers): `lib/extraction/discovery.filing.test.ts`, `lib/ingestion/filing-outcome.test.ts`,
  `lib/ingestion/ingest-filing.test.ts`, `lib/ingestion/ingest-filing.pglite.test.ts`,
  `lib/ingestion/default-deps.guard.pglite.test.ts`, `test/helpers/filing-page.ts`,
  `test/data-model-doc.test.ts`
- changed (tests/helpers): `test/helpers/ingest-fakes.ts`, `lib/ingestion/select-values.test.ts`,
  `lib/ingestion/ingest-etf.test.ts`, `lib/ingestion/ingest-etf.failures.test.ts`,
  `lib/ingestion/ingest-etf.pglite.test.ts`, `lib/ingestion/ingest-icbetnetf.pglite.test.ts`,
  `lib/ingestion/request-bound.test.ts`, `lib/ingestion/run-daily.test.ts`,
  `lib/ingestion/store.pglite.test.ts`, `lib/ingestion/default-deps.cron.test.ts`,
  `app/api/cron/daily/route.test.ts`, `app/chat/page.test.tsx`, `app/admin/etfs/page.test.tsx`,
  `test/e2e/fixture-web.ts`, `test/e2e/daily-pipeline.pglite.test.ts`
- changed (docs): `dev_minions/architecture/data-model.md`, `README.md`

## PO to confirm (drafted-criterion note)
None of this story's acceptance criteria were agent-drafted (all cited FR3.1/FR7.3/DEC-018 in the
existing story file) — nothing new to confirm beyond P-3's already-listed isolated default
(sprint-09 "Waiting on the user").

## Stray file (unrelated to this story, noted by review round 1, not an agent file)
`dev_minions/automation/.qa-goal.txt.swp` is an untracked editor swap file in the working tree —
harmless, no secret, no test impact, but should be deleted before the user commits.
