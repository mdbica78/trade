# DEC-018 — Report access, stored report links, shared catalogue labels and the daily-run budget

- Status: **Decided**
- Validated by tech-lead subagent (in-loop, DEC-009), 2026-09-27: keeps adapters pure (US-009 "no I/O") and the
  "date only from the PDF" write rule intact, gives section 3's "link to its report" a home that needs no guessed
  date, and replaces a hard-coded ETF count with a runtime guard now that admins and the chat can add ETFs (FR1, FR9)
  on a fixed 60 s Hobby function (requirements §4).
- Source: Sprint 7 review (`backlog/sprints/sprint-07.md` → "Decisions needed" #1, #2, #3, #6, #8; US-029, US-030).
  Binds Sprint 7 and every later report format, adapter and access path.

## Context
Discovery (`lib/extraction/discovery.ts`, US-007) accepts only an `<a href>` to a `.pdf`. ICBETNETF's report is
behind "a submit button, not a direct link" (requirements §3). An ETF with no adapter must still be listed "with a link
to its report" (section 3), but a `reports` row needs a `report_date` from the PDF (data-model "Write rules"). The home
table and the history page label a shared `field_key` from different adapters (Sprint 4 audit N3). The cron budget test
RT-7b hard-codes three ETFs × two requests (US-013 plan R1).

## Decision
1. **What counts as automatable access.** Plain HTTPS through Node's `fetch`; at most one request per ETF beyond
   discovery + download; every request and every followed redirect hop to the exact origin of `etfs.bvb_url`
   (`https://bvb.ro`); built only from what the fetched page contains (form action, hidden fields, the button's
   name/value) plus a session cookie from the same response if the server requires it; no JavaScript, headless
   browser, OCR, captcha or credential (those are framework-level and need their own DEC and story). New access code
   uses `redirect: "manual"`, follows a hop only when the spike findings document it, and counts it as a request.
   Headers: `BVB_REQUEST_HEADERS` plus only what a form post needs (`Content-Type`, `Cookie`). A cookie or hidden-field
   value never appears in findings, an outcome `detail`, `job_runs.log` or an error message.
2. **Non-link access lives in report discovery**, not in an adapter. The `found` discovery result carries an access
   that is either a URL (today's path, unchanged) or a replayable form-post descriptor. The descriptor exists in memory
   for one ingest or one detection only: it is never persisted, never returned to `app/`, and is executed by one
   download function in `lib/extraction/`. Adapters stay text → values with no I/O. Only a URL access is ever stored
   (`reports.source_url`, `etf_report_links.source_url`); a report whose PDF came only as a POST body has
   `source_url` NULL.
3. **A `field_key` shared by two adapters has identical `label_ro` and `label_en`** in `seedFieldCatalog`, enforced by
   a unit test on `lib/db/seed-data.ts` (with a self-check on a synthetic conflict). A field whose meaning differs gets
   its own `field_key`. The home-table and history label rules then agree by construction; neither reader changes.
4. **`etf_report_links`** (schema): `etf_id` int PK FK → `etfs.id` ON DELETE CASCADE, `source_url` text NOT NULL,
   `discovered_at` timestamptz NOT NULL. One row per ETF, upserted with one statement
   (`on conflict ("etf_id") do update`), written only by adapter detection (add / re-detect) and the daily run's
   no-adapter branch, never in the same batch as a `reports` write, never read as a report. A failed link write
   never fails the ETF insert or the daily outcome. A run that finds nothing keeps the existing row. `etfs` stays
   configuration only; `reports` keeps "date from the PDF". The migration is additive and applied to Neon only by the
   user, before the deploy that reads it.
5. **Daily-run budget.** `MAX_REQUESTS_PER_ETF` (next to `CRON_FETCH_TIMEOUT_MS`) bounds every access path, proven by
   counting-`fetch` tests. `runDailyIngestion` gets an injected clock and a deadline measured from `runDailyJob`'s
   `startedAt`: before each ETF it checks
   `now + MAX_REQUESTS_PER_ETF × CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS + FINISH_RESERVE_MS ≤ startedAt + CRON_MAX_DURATION_S × 1000`.
   An ETF that does not fit gets the outcome `not_attempted` (an error, logged, translated), never retried (FR4.1).
   `CRON_MAX_DURATION_S` lives in `lib/`; the route keeps the literal `maxDuration = 60` (Next.js reads segment config
   statically) and a test pins the two equal. The budget test is expressed over these constants, with no ETF count.

## Not decided here
- Where the symbol links when no URL is known, what "a link to its report" means to the user, and whether the detail
  page shows the marker (product, sprint-07 decisions 4, 5, 10 — defaults shipped, `NEEDS USER`).
- Raising `maxDuration` / Fluid compute (needs a live check by the user; a follow-up).

## Consequences
- US-014 AC1 ("`fetch` never called" for a no-adapter ETF) is replaced by "exactly one discovery request, no
  download" (US-030 AC3); RT-7b is replaced by a constant-based test that fails if a constant outgrows the budget.
- A new access mechanism (another form, another host) is a change to §1–§2 of this DEC, and a new adapter must pass §3.
- A change to `MAX_REQUESTS_PER_ETF` or to any timeout must keep the §5 test green; the test is never edited to pass.

## Amendment (Technical Lead, 2026-09-28, Sprint 9 review T-1)
§5's "2 requests per ETF" no longer holds once every report in the newest filing is stored (FR3.1, US-037).
`MAX_REQUESTS_PER_ETF` becomes `1 + MAX_REPORTS_PER_FILING` (`MAX_REPORTS_PER_FILING = 4`); `canStartEtf` checks only the
minimum (discovery + one PDF); a new `canStartDownload(now, startedAt)` guards every further PDF, and links that no longer
fit are `not_attempted`. The timeout and reserve constants are unchanged. The budget test stays expressed over the
constants: it is rewritten over `1 + MAX_REPORTS_PER_FILING` in US-037 as a deliberate part of this amendment, not edited to
pass. See `verification/SPRINT-09-review.md` §3 T-1.
