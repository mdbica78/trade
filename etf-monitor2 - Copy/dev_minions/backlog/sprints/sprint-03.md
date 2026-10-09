# Sprint 3 — Automation & persistence

> Detailed by agent (story-planner), 2026-09-24 — PO to confirm at demo.

**Epic:** EPIC-03
**Status:** see the `status.md` Story board
**Blocked by:** nothing for the agent. Every dependency below is Done or Awaiting QA (AGENTS.md, delivery loop step 1). The sprint's **live** checks need the Sprint 1 live chain (US-006: Neon created, migrated, seeded; Vercel project deployed with `DATABASE_URL` and `CRON_SECRET`). Until the user has done those, this sprint is built and verified offline with mocks, and its live steps wait in the QA checklists.

## Goal

History accumulates unattended; failures are visible (roadmap, Sprint 3; EPIC-03 "Done when": "the daily job runs unattended, history accumulates, and failures are visible rather than silent").

Concretely: once a day Vercel Cron calls a protected route (`/api/cron/daily`, ADR-001 Consequences). For every active ETF the route runs the Sprint 2 chain (discover → download → extract with the ETF's adapter). A complete result is stored as one `reports` row plus its `report_values` (FR3, FR4). A missing report, a fetch failure, an unreadable or incomplete report, and an ETF without an adapter each end in a distinct, recorded outcome. Nothing is retried and nothing is guessed (FR4.1, section 3, AGENTS.md). Every run leaves a `job_runs` row with its status, counts and a per-ETF log (FR13). There is no UI in this sprint. The monitoring UI is Sprint 4 and the admin dashboard that shows runs is US-024.

## Why this order

- **US-012 first.** It is the per-ETF pipeline that every other story calls. It also carries this sprint's two design constraints: DEC-010 binding note 2 (an `ok` report and its values must be written atomically on the neon-http driver) and the rule that the report date comes from the PDF only (FINDINGS trap 2).
- **US-013 next.** It turns the pipeline into the unattended daily job: auth on `CRON_SECRET`, loop over active ETFs with per-ETF isolation, and `vercel.json`. It is also the first time `unpdf` is bundled into a Next.js server route (Sprint 2 forward note). If that breaks `pnpm build`, it is found here.
- **US-014 after US-012.** It can run in parallel with US-013. It settles how every non-happy path is classified and persisted: missing report, fetch error, unreadable/incomplete report, no adapter. US-012 deliberately writes nothing on those paths, so that US-014 can decide them in one place.
- **US-015 last.** It wraps the run from US-013 in a `job_runs` row and writes the per-ETF log, using US-014's outcome vocabulary. It needs both.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-012 | Ingestion pipeline: discover → download → extract → persist, per ETF | US-003, US-005, US-007, US-008, US-010, US-011 | strong model, high thinking. Complex (DB writes under DEC-010, adapter wiring, 9 ACs) → `story-planner` plan |
| US-013 | Daily cron endpoint and Vercel Cron configuration | US-012 | mid model, medium thinking. Complex (cron/infra, route auth, 10 ACs) → `story-planner` plan |
| US-014 | Missing report, parse failure, and no-adapter handling | US-012 | mid model, medium thinking. Complex (DB writes, 9 ACs) → `story-planner` plan |
| US-015 | Job run logging | US-013, US-014 | mid model, medium thinking. Complex (cron, DB writes, 10 ACs) → `story-planner` plan |

## Decisions needed (collected from the stories)

None of these blocks a story. The two PRODUCT items are implemented with the literal reading of the FR they come from, so the PO can confirm or change them at the demo. The TECHNICAL items are for the in-loop `tech-lead` to settle in the sprint review (DEC-009).

| # | Story | Type | Question | Recommendation |
|---|---|---|---|---|
| 1 | US-012 | PRODUCT | Persist only the ETF's tracked fields (FR3 literal: "extracts the selected parameters"), or every field the adapter extracts? | Store every extracted field, so a field the user starts tracking later already has history. The story ships the literal reading, and the change is one isolated function. |
| 2 | US-012 | PRODUCT | Catch-up filings: on Mondays BVB files the Friday, Saturday and Sunday reports in one row. Ingesting only the most recent report (FR3 literal) means **the Friday and Saturday reports are never stored, every week**. | Ingest every report link in the newest filing row. This is one filing, not a backfill (FR4.2 is about new ETFs) and not a retry (FR4.1). The story ships the literal reading, and its design keeps discovery separate from per-report ingestion so the change stays small. |
| 3 | US-013 | TECHNICAL | Initial cron schedule (UTC) before US-023 makes the hour adjustable (FR12). | `0 10 * * *`. The observed BVB filings arrive at 09:09–09:34 Bucharest time (`test/fixtures/bvb/README.md` §7, §2), which is 06:09–06:34 UTC in summer and 07:09–07:34 UTC in winter. That leaves at least 2.5 h of margin even if Hobby cron fires anywhere inside the hour. |
| 4 | US-014 | TECHNICAL | Failures with no report date (fetch error, not found, unreadable, adapter `ok: false`, no adapter): `reports.report_date` is NOT NULL and means "the date the report is for". Write no `reports` row and record them in the run log only, or write a row with the run date, or add a new per-run table? | No `reports` row. Record them in the `job_runs` log (US-015). No schema change and no fake dates. The `missing`/`no_adapter` status values stay unused for now. The data model calls a `missing` row "optional bookkeeping". |
| 5 | US-014 | TECHNICAL | Partial extraction (report date found, some persisted fields missing): keep the values that were found under a `parse_error` row, or store none? | Keep them under `status = 'parse_error'`, with `error_message` naming the missing fields. Nothing correct is thrown away, and the row is still flagged. Whether Sprint 4 displays values from `parse_error` rows is Sprint 4's call (forward note). |

**Tech-lead sprint review 2026-09-24** (`verification/SPRINT-03-review.md`): #3, #4 and #5 are **Decided** as recommended (`0 10 * * *`; no `reports` row without a PDF date; partial values kept under `parse_error`). #1 and #2 stay **NEEDS USER** at the demo. They do not block anything, because the stories ship the literal FR3 reading.

## Sprint Definition of Done

- All four stories reviewed and tested (PASS/PASS), Awaiting QA, then accepted by the user.
- `pnpm test` runs fully offline (mocked `fetch`, fake or in-process database, committed fixtures) and proves:
  - the committed instrument-page fixture plus a committed PDF fixture give one `ok` report with the PDF's report date and the expected values, written atomically (US-012);
  - a same-day re-run stores nothing twice (US-012);
  - the cron route rejects calls without the right `CRON_SECRET`, processes every active ETF once, and isolates per-ETF failures (US-013);
  - each non-happy path gives its own outcome and never an `ok` row or a guessed value (US-014);
  - every run leaves a finished `job_runs` row with the correct status, counts and log (US-015).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass, with `unpdf` bundled into the cron route.
- **No schema change** is expected (data model and DEC-010 already cover everything). If a story's plan finds one is needed, the migration is generated locally and never applied to Neon by an agent (AGENTS.md).
- The user has run the live checks below, and at least one scheduled (not manual) run has written a `job_runs` row on the deployment.

## Manual QA the user must perform in this sprint

Needs the Sprint 1 live chain first (US-006 QA): Neon created, `pnpm db:migrate` and `pnpm db:seed` applied, Vercel project deployed with `DATABASE_URL` and `CRON_SECRET` set. Sprint 3 adds no migration unless a story's QA file says otherwise.

1. **Local run against Neon (optional, before deploying).** In WSL, with `DATABASE_URL` and `CRON_SECRET` in `.env.local`:
   `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm dev`, then in a second shell
   `curl -s -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/daily`.
   Expected: a JSON summary with one outcome per seeded ETF (`ok` on the first call).
2. **Auth.** `curl -s -o /dev/null -w "%{http_code}" https://<your-app>.vercel.app/api/cron/daily` → `401`. The same call with a wrong bearer value → `401`.
3. **Cron registered.** Vercel dashboard → project → Settings → Cron Jobs: exactly one job, path `/api/cron/daily`, with the schedule from `vercel.json`. Vercel runs cron jobs only for **Production** deployments.
4. **Manual trigger on the deployment.** `curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron/daily`. Then in the Neon SQL editor:
   ```sql
   select * from job_runs order by id desc limit 5;
   select e.symbol, r.report_date, r.status, r.source_url, r.error_message
     from reports r join etfs e on e.id = r.etf_id order by r.report_date desc, e.symbol;
   select r.report_date, e.symbol, v.field_key, v.raw_value, v.numeric_value
     from report_values v join reports r on r.id = v.report_id join etfs e on e.id = r.etf_id
     order by r.report_date desc, e.symbol, v.field_key;
   ```
   Open each `source_url` in a browser. The report date and the stored values must match the PDF.
5. **Idempotency.** Trigger again the same day. There is no new `reports` row. The outcomes say `already_ingested`, and a second `job_runs` row with status `success` appears.
6. **Unattended.** On the next day(s), without triggering anything: a new `job_runs` row appears after the scheduled hour. On business days a new `reports` row appears per ETF.
7. **PO confirmation:** every story in this sprint was drafted by an agent. Confirm or correct the acceptance criteria, and answer the two PRODUCT items in the table above (tracked vs all fields; catch-up filings).

## Notes for whoever details Sprint 4 (forward flags, not Sprint 3 scope)

- **Values under `parse_error` rows** (decision 5): the home table and the detail page must decide whether to show them, per field, next to a visible flag, or to show only `ok` rows. FR4.1 needs "no value", never a guessed one.
- **"Previous day"** for the FR7 delta: with decision 2 left at the literal reading, stored dates have a weekly gap (Friday and Saturday). The delta story (US-017) must define "previous day" as the previous **stored** report date, or as the previous calendar day (then blank). That is a PRODUCT question if decision 2 stays literal.
- **Home-table PDF link (FR7)** comes from the latest `reports.source_url`. Under decision 4 an ETF without an adapter has no `reports` row, so it has no link until US-030 (section 3: "still shown in the list (with a link to its report)").
- Sprint 1 audit N2: set `timeZone` in `i18n/request.ts` before the first story that formats dates (Sprint 4 renders report dates).
- DEC-007 applies to every number Sprint 4 renders. Stored `numeric_value` strings are canonical (no separators).
- Sprint 2 audit W2 (vacuous "no real network" tests in `discovery.test.ts` / `pdf.test.ts`) and N1 (pin `"unpdf": "0.11.0"` exactly): fix whenever those files or `package.json` are next touched.
- FR12 on Vercel Hobby: the schedule lives in `vercel.json` and changes only on redeploy. US-023 (admin cron hour) must say how a change in `settings.cron_hour_utc` reaches Vercel. That is a Sprint 5 question, flagged here only because US-013 creates the file.
