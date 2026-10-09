# Sprint 7 review: Hardening

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-27.

Verdict: APPROVED

- US-029: APPROVED — wording fixed in place (Task 4 "save, the user commits"; AC3 FALLBACK may still return a correct direct link when only extraction fails; AC4 headers, same-origin redirect hops counted, sentinel test for cookie/hidden-field values; AC8 names `units_held_individuals` and adds the investors-side bound test). `## Tech-lead review` adds six plan points (redirects invisible to a recording mock, `fetchOnce` is GET-only, Phase A never prints a cookie, third-request ordering + chat/admin add budget, nullable `sourceUrl` readers, invariant self-check).
- US-030: APPROVED — wording fixed in place (AC5 comparison columns; Notes: schema-test count 7 → 8, deadline measured from `runDailyJob`'s `startedAt`). `## Tech-lead review` adds seven plan points (constants and the static `maxDuration` literal, deadline wiring, `not_attempted` by exclusion, separate link writer outside the report batch, `DetectionResult` URL with unchanged reasons, link-rule comparison, deploy order).
- US-031: APPROVED — no in-place change. `## Tech-lead review` adds five plan points (seams keep production defaults, fetch-guard evidence, smoke redirects and per-page failure keys, `/health` timeout and real-page test, wait if US-029 is Blocked).

Technical decisions #1, #2, #3, #6, #7, #8, #11 are **Decided** in `sprint-07.md`; #2, #3, #6, #8 bind beyond the sprint and are recorded in **DEC-018** (indexed in `decisions/README.md`). Product decisions #4, #5, #9, #10, #12 each ship an isolated default (`NEEDS USER — default shipped`); none blocks a story.

Scope: `backlog/sprints/sprint-07.md` and `backlog/stories/US-029.md` to `US-031.md`, drafted by `story-planner`.

Checked against:
- `requirements/etf-monitoring-requirements.md` (§1, FR1, FR3, FR4, FR4.1, FR4.2, FR5, FR7, FR8, FR8.1, FR9, FR13, sections 3, 4, 5, 6);
- `backlog/roadmap.md` (Sprint 7 titles; carry-forward "Sprint 7" and "Any sprint"), `backlog/epics.md` (EPIC-07 "Done when");
- `sprint-05.md` / `sprint-06.md` forward notes; `verification/SPRINT-01-audit.md` (W4, W5, W6), `SPRINT-02-audit.md` (N3), `SPRINT-04-audit.md` (N3, N4, N6, W3), `SPRINT-05-audit.md` (N3), `SPRINT-06-audit.md` (W1–W3, N5);
- DEC-010, DEC-015, DEC-016, DEC-017; `architecture/data-model.md`;
- the code the stories cite (below).

## Independent checks (what I read myself)
- **Discovery** (`lib/extraction/discovery.ts`): isolates the `gv5News` table, candidate = title folded to "van la data" + an href resolving to absolute `http(s)` ending in `.pdf`; `javascript:`/`#` rejected (`resolvePdfHref`); a row without a PDF href yields `pdfUrl: null`, never a candidate. Accepts any host today. BRD report PDFs in the fixtures are on `https://bvb.ro/infocont/...` (`test/fixtures/bvb/README.md:128`), so the DEC-018 §1 same-origin rule costs the BRD path nothing. US-029/US-030 "What exists" match.
- **HTTP** (`lib/extraction/http.ts`): `fetchOnce` is GET-only, races request + body read against a timer, and follows redirects (default `fetch`). Hence the redirect precision in decision 1 and the US-029/US-031 plan points.
- **Ingestion** (`lib/ingestion/ingest-etf.ts`): `no_adapter` returned before discovery for a NULL or unregistered key (US-014 AC1 text confirmed in `US-014.md:47`); `ingestReport` takes a `ReportLink` with `pdfUrl: string`; `persist` needs a non-null `sourceUrl`. `INGEST_OUTCOME_CODES` has eight codes (`lib/ingestion/outcome.ts:3-12`); `isErrorOutcome` classifies by exclusion (`job-run-summary.ts:13-15`), so `not_attempted` needs no summary change.
- **Budget**: `CRON_FETCH_TIMEOUT_MS = 7_000` (`run-daily.ts:3`); RT-7b = `3 × 2 × 7 s + 15 s = 57 s ≤ 60 s` (`route.test.ts:33-40`), so any fourth active ETF or third request breaks it — decision 8 is needed now, not later. `runDailyJob` takes `startedAt` before the stale sweep (`daily-job.ts:27-29`). `/chat`, `/admin/etfs` and the cron route all export `maxDuration = 60`; `AI_PROVIDER_TIMEOUT_MS = 20_000`.
- **Detection** (`lib/config/detect-adapter.ts`): reasons `detected | not_found | fetch_error | unreadable | no_match | ambiguous | internal_error`; the discovered URL is discarded. `addEtf` inserts only `etfs` (no `tracked_fields`). US-030 AC2's reason list is exact.
- **Home / history** (`lib/monitoring/home.ts:116-122`, `:306`; `history.ts:27-37`): link = newest `reports` row with a `source_url` by `report_date desc, id desc`; labels from the alphabetically first `adapter_key`; history labels from the ETF's own adapter; history has no availability flag yet (US-030 adds it). `HomeTable.tsx:48` already opens links in a new tab.
- **Schema / PGlite**: `drizzle/meta/_journal.json` has one entry (`0000_init`); `test/helpers/pglite.ts` reads only `0000_init.sql`; `lib/db/schema.test.ts:44` pins seven tables; `drizzle.config.ts` needs no `DATABASE_URL` to generate.
- **BRD adapter** (`brd-depositary.ts`): units sub-search region ends at `text.length` when the investors label is missing; investors sub-searches (`numberAfterLabel(..., investorsEnd)`) have no end bound. Sprint 2 audit N3 confirmed; AC8 now tests both sides.
- **`/health`** (`app/health/page.tsx`, `lib/health.ts`): renders the exception text via `dbError`; `getHealthStatus` has no timeout; `loadHealthStatus` is not exported. `MissingDatabaseUrlError` exists (`lib/db/index.ts:5`). `FieldChart.tsx:66` wires `ChartTooltipContent` through `<Tooltip content=…>`; `NEXT_LOCALE` is `LOCALE_COOKIE` (`i18n/locale.ts:4`); `tsx` is a dev dependency; `buildSeedStatements` exists (`lib/db/seed.ts:19`).

## Criteria
- Every AC cites an FR, a requirements section or the audit/decision it discharges; the gate ACs (US-029 AC10, US-030 AC11, US-031 AC7) cite AGENTS.md, as in earlier sprints.
- All ACs are testable offline (PGlite, committed fixtures, mocked `fetch`, fake clock); live steps (bvb.ro capture, Neon migration, deployment smoke, scheduled cron, provider commands, Vercel logs) are MANUAL-QA with a concrete check.
- No invented product choice ships except as a named, confined default: #10 (detail-page marker) goes beyond section 3's "in the list" but rests on EPIC-07's PO-written "degrades visibly", reuses the existing translated marker, and is confined to `components/EtfDetail.tsx` + one flag — acceptable as an isolated default, flagged for the PO.
- Dependencies and order: US-029 and US-030 are independent (shared constant handled by whichever lands first); US-031 depends on both. The one ordering trap (a third ICBETNETF request breaks RT-7b before US-030's guard exists) now has an explicit rule (decision 8 row).
- Carry-forward: roadmap Sprint 7 (report link → US-030; column labels → US-029 decision 3 / DEC-018 §3) and "Any sprint" (FieldChart W3 → US-031 AC5; `/health` W4/W6 → US-031 AC4; W5 and IF-8c already closed in Sprint 5) are all handled; out-of-scope items carry a reason.

## Notes (non-blocking)
- **N1 — Sprint can stall on one live step.** If Phase A of US-029 cannot reach bvb.ro, US-029 and therefore US-031 are Blocked on the user; only US-030 proceeds. This is the honest dependency (US-031 must cover what US-029 shipped); the demo file should say so plainly.
- **N2 — FR7 for adapter ETFs after a failed download.** With an adapter, the daily run does not refresh `etf_report_links`, so if discovery finds a newer PDF but the download or parse fails without a report date, the symbol keeps pointing to the older report. Existing behaviour, unchanged by this sprint; a candidate PO question later, not Sprint 7 scope.
- **N3 — `status.md`** still shows Sprint 7 as "Not detailed yet" (`status.md:18`); the dev loop adds the US-029..031 rows.

Denied or attempted commands: none (no git, no secret or credential file read, no variable value printed).
