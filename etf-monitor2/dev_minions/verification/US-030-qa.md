# US-030 QA checklist — No-adapter degradation path, end to end

Round 1: review PASS (`US-030-review.md`, no Critical — W1-W4 fixed in place this round except W2
and W5 accepted as-is, see HANDOVER.md), tests PASS (`US-030-tests.md`, 1640/1640 full suite, all
11 acceptance criteria MET). Complex story (DB schema + migration + cron-budget change);
plan by `story-planner` at `US-030-plan.md`.

Every acceptance criterion agent-drafted in `backlog/stories/US-030.md` — **PO to confirm.**

## Automated (already run this round, evidence in US-030-tests.md / US-030-review.md)

1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — 0 errors.
3. `pnpm lint` — 0 errors, 6 pre-existing warnings (one more than the previously-recorded 5, from
   a pre-existing pattern in `lib/cron/default-deps.test.ts`, unrelated to this story).
4. `pnpm test` — 1640/1640 passed, 149 files.
5. `pnpm build` and `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` — both
   succeed offline; no `package.json`/`pnpm-lock.yaml` change (confirmed absent from "Files
   changed").
6. No new dependency; AC11's gate list is fully green.

## Manual / live (for the user, or Codex QA where it can reach bvb.ro / Neon)

1. **(AC1, MANUAL-QA, sprint-07 step 1 — do this BEFORE deploying)** Run
   `DATABASE_URL=<neon-url> pnpm db:migrate` locally. Then, in the Neon SQL editor, run
   `select * from etf_report_links;` — expect an empty table, not an error. Deploying before
   migrating leaves the home page in its translated no-database-error state until the migration
   runs (by design, AC8).
2. **(sprint-07 step 4, `/admin/etfs` and `/chat`)** Add an unmonitored fund unit (one bvb.ro
   lists but has no adapter for) through `/admin/etfs`, then remove it and add it again through
   `/chat`. Each time, expect:
   - the admin list shows adapter "none";
   - the home row shows "extraction unavailable", and its symbol either opens that fund's newest
     report PDF, or is plain text if bvb.ro lists none (P12 default);
   - `/etf/<SYMBOL>` shows the "extraction unavailable" marker;
   - after the next scheduled run, `/admin/operations` shows the run `partial` with a translated
     "adapter missing" line for that ETF;
   - remove the test ETF at the end.
3. **(sprint-07 step 4, timing)** After the next scheduled run, check the Vercel function
   duration is well under 60 s and no `not_attempted` line appears for the current ETF count
   (the guard is a safety margin, not expected to trigger yet).
4. **(product decisions, already shipping isolated defaults — see HANDOVER "Waiting on the
   user" P12-P14)** Confirm, or ask for the alternative:
   - P12 — symbol link with no direct PDF URL known: plain text (recommended alternative: link to
     `bvb_url`).
   - P13 — "a link to its report" for a no-adapter ETF: the newest depositary-report PDF link
     report discovery finds.
   - P14 — does the ETF detail page show "extraction unavailable" too: yes.
5. **(non-blocking, from review W1)** No automated test deletes an `etfs` row and checks its
   `etf_report_links` row cascades away, though the FK is declared `ON DELETE CASCADE` in both
   the schema and the generated migration SQL, and no production code path deletes an `etfs` row
   today. If a future story adds ETF deletion, add that PGlite test at the same time.

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed (US-030, in flight)" for the complete list (schema,
migration, `lib/ingestion/report-links.ts`, `ingest-etf.ts`, `run-daily.ts`, `outcome.ts`,
`lib/config/detect-adapter.ts`, `etfs.ts`, `lib/monitoring/home.ts`, `history.ts`,
`components/EtfDetail.tsx`, `lib/cron/daily-job.ts`, both `default-deps.ts` files,
`test/helpers/pglite.ts`, `messages/{en,ro}.json`, `dev_minions/architecture/data-model.md`, and
every new/changed test file listed there), plus this file and `US-030-plan.md`,
`US-030-review.md`, `US-030-tests.md` (new).
