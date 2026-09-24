# Sprint 3 review: Automation & persistence

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-24.

Scope: `backlog/sprints/sprint-03.md` and `backlog/stories/US-012.md` to `US-015.md`, all drafted by `story-planner`.

I checked them against:
- `requirements/etf-monitoring-requirements.md` (FR1–FR4.2, FR5, FR7, FR8.1, FR12, FR13, sections 3, 4 and 5);
- `backlog/roadmap.md` and `epics.md` (EPIC-03);
- `architecture/data-model.md`, ADR-001 and DEC-010 (binding note 2);
- `SPRINT-02-audit.md`;
- the code the stories build on: `lib/db/{schema,index,seed-data}.ts`, `lib/extraction/{discovery,pdf,report-latest}.ts` and `lib/extraction/adapters/{types,validate}.ts`;
- the fixtures: `test/fixtures/bvb/README.md` §2/§7 and `test/fixtures/expected.json`.

Independent checks:
- **The AC1 pairing holds.** In README §7, the newest link on the BTBETRETF instrument page is the `…-22-09-2026.pdf`. `expected.json` has a `BTBETRETF-2026-09-22.pdf` entry with `reportDate` 2026-09-22.
- **The catch-up example is right.** 2026-09-18 is a Friday and 2026-09-21 is a Monday, so PRODUCT decision 2 describes a real weekly loss under the literal reading.
- **No middleware intercepts routes.** There is no `middleware.ts`/`proxy.ts` (the locale is cookie-based), so `/api/cron/daily` will not be locale-redirected.
- **Timeouts can already be injected.** Both `discoverLatestReport` and `downloadReportPdf` accept `timeoutMs`, so US-013's duration-budget fallback needs no Sprint 2 change.
- **Adapter first is correct.** In `report-latest.ts` the adapter lookup comes after the download. US-012/US-014 correctly move it first.

I ran no git command and read no `.env*` file.

Verdict: APPROVED

## Per story

- **US-012: APPROVED after small in-place fixes.**
  - Every AC cites FR3/FR4/FR7/FR13, DEC-010 or an AGENTS.md rule.
  - DEC-010 note 2 is carried correctly: the plan must name pattern (a), (b) or (c), and AC4 is testable for each.
  - The report date comes only from the PDF (AC2).
  - Fixes:
    - added US-011 as a dependency (AC1 uses its 2026-09-22 fixtures);
    - renamed the success outcome `ingested` to `ok`, so US-013, US-014 and US-015 share one stable code from the start instead of renaming later;
    - AC6's "exactly one discovery request" now excludes the no-adapter path, which Task 1 resolves before any network call;
    - noted that Drizzle's `batch()` is driver-specific when PGlite is used for tests.
  - Two PRODUCT items stay open (see below).
- **US-013: APPROVED after small in-place fixes.**
  - Auth follows the US-006 README `CRON_SECRET` contract and fails closed.
  - The single cron entry and the once-a-day check match section 4 and the FR12 note.
  - The `maxDuration` / Fluid-compute check is correctly pushed to the plan.
  - Fixes:
    - a thrown `ingestEtf` now has a named outcome (`internal_error`), which was a silent-failure gap for US-015's error count;
    - tracked fields get a deterministic tie-break (`display_order`, then `field_key`);
    - `is_active` filtering is now required in both the loader and the runner, so AC2's fake-loader test proves real behaviour.
  - Decision 1 **Decided: `0 10 * * *`**. It is valid on Hobby, gives at least 2.5 h of margin after the observed filings in both seasons, and is reversible. It becomes the user's setting in US-023.
- **US-014: APPROVED, with a `## Tech-lead review` section appended.**
  - The outcome vocabulary maps every Sprint 2 result kind onto one code.
  - `canHandle` false gives `parse_error`, with no fallback to `detect`, which is correct under section 3 and US-009.
  - Decision 1 **Decided: A.** No `reports` row without a PDF date. There is no fake date and no schema change, and the failure stays visible through the US-015 log.
  - Decision 2 **Decided: A.** Found values are kept under `parse_error`. This is storage only, and display is a Sprint 4 question.
  - The appended section requires two things:
    1. The plan lists the US-012 tests it changes, because AC5/AC6 deliberately supersede US-012 AC3/AC7 on the incomplete and violation paths. Without that list, a reviewer could read the change as weakening a test.
    2. The "never downgrade `ok`" rule is enforced inside the write (a status-conditioned upsert, with values scoped to the same condition), not only through `findReport`. Two overlapping runs could otherwise overwrite an `ok` row's values under DEC-010 pattern (a).
- **US-015: APPROVED after small in-place fixes.**
  - Status and count rules, stale-run sweep, log format, secret exclusion and abort handling are all testable with fakes. They trace to FR13 and the `job_runs` columns in the data model.
  - Fixes:
    - `errors_count` now counts every outcome except `ok`/`already_ingested`, by exclusion, so `internal_error` and any future code can never be counted as success;
    - a failing `failStaleRuns` is handled like a failing `startRun` (500, nothing processed). Before, it was unspecified.
  - Counting `no_adapter` and `missing` as errors is an interpretation of FR13 and section 5 ("flags that an adapter is missing"). It is not an invented feature, and the PO confirms all ACs at the demo.

## Sprint file

- The scope matches the roadmap's Sprint 3 titles and EPIC-03's "Done when". There is no UI, no schema change, and no retries or alerts (FR4.1).
- The dependencies and order are correct:
  - US-012 depends on Sprint 1/2 stories that are Done or Awaiting QA (now including US-011);
  - US-013 and US-014 both depend only on US-012, so they can run in parallel;
  - US-015 depends on both.
- Manual QA steps 1–7 cover every MANUAL-QA criterion, including the Production-only cron behaviour and the PO confirmation.
- I added a line under "Decisions needed" that records #3, #4 and #5 as Decided.

## Needs the user (non-blocking, for the demo)

Both items ship the literal FR3 reading, so no product choice was invented and no story is blocked:
1. **US-012 PRODUCT 1:** persist tracked fields only (as shipped) or every extracted field? The planner recommends every field.
2. **US-012 PRODUCT 2:** catch-up filings. Under the literal reading, the Friday and Saturday reports are never stored, because the Monday row holds Fri/Sat/Sun and only the newest link is taken. This is arguably consistent with FR4.1 ("delayed → blank"). The planner recommends a follow-up story to ingest every link in the newest filing row.
   - This also sets the Sprint 4 "previous day" definition for the FR7 delta.

## Notes (not blocking)

- N1: Several ACs cite ADR-001, DEC-010 or AGENTS.md rather than an FR: the gate ACs, US-012 AC8 and US-013 AC7. These are technical criteria traced to accepted rules. Accepted, as in the Sprint 2 review N1.
- N2: `already_ingested` is only known after download and extraction, because the date comes from the PDF. So every run downloads each PDF once, including on weekends. That is one small request per ETF per day. Acceptable, and not worth a `source_url` shortcut, which would weaken the PDF-date rule.
- N3: Sprint 2 audit W2/N1 (vacuous no-network tests, exact `unpdf` pin) are carried as forward notes in sprint-03.md and US-013. The implementer should fix them if those files are touched.
