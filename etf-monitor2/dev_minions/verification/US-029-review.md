# US-029 review

## Round 1 — 2026-09-27

Verdict: PASS

Reviewer: story-reviewer (fresh context, independent of the implementer). I read AGENTS.md,
`dev_minions/backlog/stories/US-029.md`, `dev_minions/verification/US-029-plan.md`,
`spikes/icbetnetf/FINDINGS.md`, DEC-018, and every file listed under "Files changed (US-029, in
flight)" in HANDOVER.md, in full. I re-derived every claim below myself: read the shipped PDF
fixture with the Read tool and transcribed its 8 values and report date by eye (never taking
`expected.json`'s numbers on trust), ran `wc -c` on both fixtures, grepped for secret patterns, ran
`pnpm typecheck` and `pnpm lint` myself, and ran the story's test files directly with `pnpm vitest
run` (not the full suite — that is the tester's gate). I also confirmed by `find -newermt` that the
only `lib/`/`components/`/`app/` source files touched since Phase A match HANDOVER's "Files
changed" list exactly, and that `discovery.ts`, `http.ts`, `pdf.ts`, `ingest-etf.ts`, `store.ts`,
`detect-adapter.ts`, `etfs.ts` contain no ICBETNETF/InterCapital reference (unchanged, as the plan
requires) and `package.json`/`pnpm-lock.yaml` were not touched (no new dependency, AC10).

### Acceptance criteria

- **AC1 — Investigation recorded: MET.**
  `spikes/icbetnetf/FINDINGS.md` states the URL, the `gv5News` markup (byte-for-byte the same
  shape as BRD's decorative `<input type="submit">` + sibling `<a href>`), the mechanism (plain GET
  on a direct `.pdf` href, no form/cookie/hidden field), cookie **names** only (no values, verified
  by grep — none of `ASP.NET_SessionId=`, `cookiesession1=`, `.ASPXAUTH=`, `Set-Cookie:` appears in
  the file), status/content-type/byte counts, label excerpts, and one verdict (ADAPTER) against both
  decision-1 conditions (FINDINGS.md §4). I independently checked FINDINGS' claims against the
  committed fixtures: `wc -c` gives exactly 70666 (HTML) and 306610 (PDF), matching FINDINGS §1/§6
  exactly; the `gv5News` row markup and href are proven in code by
  `lib/extraction/discovery.icbetnetf.test.ts` DI-1/DI-2 (lines 23–55), which I ran and which pass.
  I also opened the PDF myself (Read tool renders it) and confirmed the header/date/value text
  FINDINGS quotes is exactly what the fixture contains.
  MANUAL-QA: the live capture itself (opening the bvb.ro page and confirming the PDF opens
  directly) is correctly deferred — the plan (§6 item 1) and the story (AC1's own wording, "The
  live capture itself is a MANUAL-QA step") both name the concrete check.
- **AC2 — Fixtures committed: MET.**
  `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` and `test/fixtures/ICBETNETF-2026-09-24.pdf`
  are committed; `test/fixtures/bvb/README.md` §8 documents the page fixture. `expected.json`'s
  ICBETNETF entry has a `source` field naming an independent transcription and cites the same
  procedure as `test/fixtures/README.md`. I transcribed the PDF myself from the rendered page and
  its values match `expected.json` exactly (Class A EUR 26.9315/1,196,346/32,219,356.78; Class B
  RON 142.1413/514,169/13,847,299.12; TOTAL 1,710,515/46,066,655.90; date 24.09.2026) — an
  independent check, not a re-read of the plan's own excerpt. The "every PDF has a manifest entry /
  every entry has a PDF" tests (`lib/extraction/fixtures.test.ts`, ran myself) pass. New FX-7
  (`fixtures.test.ts:282-312`) scans every fixture's extracted text and the ICBETNETF HTML fixture
  for cookie/credential/env-var name patterns and passes; I ran the same grep by hand over the
  fixture and FINDINGS and found nothing.
- **AC3 — Discovery never returns a wrong link: MET.**
  `discovery.ts` is untouched (confirmed, no ICBETNETF/InterCapital reference, not in Files
  changed). I ran `discovery.test.ts`, `ingest-etf.test.ts`, `ingest-etf.failures.test.ts`,
  `detect-adapter.test.ts` myself — all pass unchanged (113 tests). New
  `lib/extraction/discovery.icbetnetf.test.ts` DI-1 (exact URL/title/publishedAt, 1 request), DI-2
  (URL is a literal fixture href, not the prospectus/KID/a guessed URL), DI-3 (falls back to the
  second row's own URL+title when the newest row's `<a>` is removed; `not_found`/`no_report_entries`
  when every `<a>` is removed) all pass — I ran this file directly.
- **AC4 — Access requests exact and bounded (ADAPTER branch): MET.**
  FINDINGS §2/§4 show no form post and no redirect exist for ICBETNETF, so the plan correctly marks
  the form-action/redirect-host and POST-body-nullable-`source_url` rules "NOT APPLICABLE" (no new
  access code exists to govern) — I checked this reasoning against FINDINGS myself and it holds.
  `lib/ingestion/request-bound.test.ts` AX-1 (lines 98–125, ran myself) proves the exact
  `[GET page, GET PDF]` sequence, both GET, both `https://bvb.ro` origin, no `Content-Type`/`Cookie`
  header. AX-2 (127–190) injects sentinel cookie/hidden-field values and proves neither appears in
  the outcome, `formatRunLog`'s output, or any recorded request, on both the happy path and a PDF
  500. The "button missing" case (192–213) gives one request and outcome `missing`. `adapters/*`
  gain no I/O: `lib/extraction/adapters/boundaries.test.ts` scans the directory dynamically (so it
  automatically covers the new `text.ts`/`intercapital-nav.ts` without a hand-maintained file list)
  and passes.
- **AC5 — second adapter, label-based: MET.**
  `lib/extraction/adapters/intercapital-nav.ts` matches on the three header labels in order
  (`findHeaderEnd`), reads each class row positionally only after the labelled header, per
  FINDINGS §7's documented positional rule; `canHandle` is structure-based (header order) and false
  on BRD text; `brdDepositaryAdapter.canHandle` is proven false on the ICBETNETF text
  (`intercapital-nav.test.ts:348-350`). `intercapital-nav.test.ts` (363 lines, ran myself, all
  passing) proves: exact identity/registration, date parsing (only the RO `Data:` line, never the
  English line, never the Croatian page-2 dates, conflict/impossible-date → `ok:false`), all 8
  values on the default text, order-independence, and — crucially — every "reject the row, never
  shift/borrow" case (wrong currency, non-numeric token, extra trailing number, European-format
  token, missing class label, missing TOTAL, reordered/missing header column) each leaves exactly
  the affected fields in `missingFields` and the rest intact. `seedFieldCatalog` carries the 8
  `intercapital-nav` rows with RO/EN labels (`lib/db/seed-data.ts`). No new formatting code: no file
  under `lib/format/` or `components/HomeTable*`/`EtfDetail*` is in Files changed.
- **AC6 — end to end on PGlite: MET.**
  `lib/ingestion/ingest-icbetnetf.pglite.test.ts` IC-E2E-1..4 (ran myself, all 4 pass): one `ok`
  report with `source_url` = the PDF URL and the two tracked values exactly matching
  `expected.json`; a rerun gives `already_ingested` with still one row (DEC-010); the shipped
  `createHomeTableLoader` shows `adapterAvailable: true`, the report date, the link, the two cell
  values and the catalogue's own RO/EN labels; `addEtf` over the shipped `detectAdapter` stores
  `adapter_key = intercapital-nav` with reason `detected` and writes no `reports`/`tracked_fields`
  row.
- **AC7 — FALLBACK branch: N/A, correctly.** FINDINGS' ADAPTER verdict is genuine, not merely
  asserted: I independently re-checked both decision-1 conditions from primary evidence — the fetch
  commands and byte counts in FINDINGS §1/§6 show a plain two-request GET path with no form/cookie/
  JS, and reading the committed PDF myself confirms stable bilingual labels and a report-date line
  distinct from the filing stamp. The shipped branch (adapter + no discovery change) matches the
  verdict, satisfying the story's "Branch evidence" check; no Critical finding here.
- **AC8 — BRD sub-searches bounded: MET.** `brd-depositary.ts` bounds both the units and investors
  sub-searches to a documented 7-token window (`BRD_BLOCK_TOKENS`, lines 34, 119, 150). I traced
  BB-1 and BB-2 (`brd-depositary.test.ts:450-472`, ran myself) by hand against the segment builder:
  BB-1's stray "Persoane fizice" value falls exactly outside the units-block window, so
  `units_held_individuals` is correctly missing and `18,631` is never taken, while
  `units_held_legal_entities` (inside the window) is unaffected; BB-2's stray value in the
  signature segment falls outside the investors-block window, so `investors_individuals` is missing
  and `999` is never taken, while `investors_legal_entities` is unaffected. A regression guard
  (line 474-478) and the fixtures pipeline (`fixtures.test.ts`, ran myself) confirm all six BRD
  fixtures still extract unchanged.
- **AC9 — Per-ETF request bound: MET.** `MAX_REQUESTS_PER_ETF = 2` in `lib/ingestion/run-daily.ts`.
  `request-bound.test.ts` RB-1..RB-4 (ran myself) prove the BRD path, the ICBETNETF path, three
  failure paths, and the add-time `detectAdapter` path each stay at or under the constant. RT-7b
  (`app/api/cron/daily/route.test.ts`, ran myself) now imports the constant instead of a literal
  `2` and still passes (budget unchanged, 57s ≤ 60s). New CPG-4b (`app/chat/page.test.tsx`) and
  PG-7b (`app/admin/etfs/page.test.tsx`) — both ran myself, pass — prove the add-time budget
  (chat: `AI_PROVIDER_TIMEOUT_MS` + `MAX_REQUESTS_PER_ETF × CRON_FETCH_TIMEOUT_MS` + 15s allowance;
  admin: without the AI timeout) each stay under `maxDuration`.
- **AC10 — Label invariant, offline, gates: MET.** `lib/db/seed-data.test.ts` SL-1 (shipped
  catalogue has no conflict), SL-2 (a synthetic conflicting catalogue is caught), SL-3 (at least
  `nav_per_unit` really is shared, so SL-1 is not vacuous) — ran myself, all pass, and SL-1/SL-2
  both call the same `findSharedKeyConflicts` function (tech-lead binding point 6 honoured — no
  duplicated logic). No test in the new/changed files reaches the network: every one uses
  `readFileSync` fixtures or a stubbed `fetch`. `package.json`/`pnpm-lock.yaml` unmodified (checked
  file mtimes myself, both last touched 2026-09-25, well before this story) — no new dependency.
  Gates I ran myself: `pnpm typecheck` (clean), `pnpm lint` (0 errors, 5 pre-existing warnings,
  matching HANDOVER's own count). I did not re-run `pnpm build` or the `DATABASE_URL`-unset build
  myself this round — not re-run; HANDOVER reports both green including the new routes.

### Non-negotiable rules (AGENTS.md)

- Deterministic label-based extraction, no AI: both new/changed adapters are pure label/structure
  matching; the "positional rule" for `intercapital-nav`'s per-class rows is documented in a spike
  finding (`FINDINGS.md` §7) exactly as AGENTS.md requires for that exception.
- One adapter per report format: `intercapital-nav` is new and separate from `brd-depositary`;
  `registry.detect` returns exactly one adapter per fixture (proven by FX-5/FX-6 in
  `fixtures.test.ts`, and by `intercapital-nav.test.ts`'s explicit cross-`canHandle` checks).
  Registered in `default-registry.ts`.
- Report date from the PDF's own text, never the filing stamp: both adapters parse an in-document
  date label (BRD footer; InterCapital `Data:` line); `data-model.md`'s write-rule wording was
  updated to say so explicitly (wording only, no rule change — confirmed by reading the diff
  context, the write rule itself is unchanged).
- next-intl ro+en: the one new UI-facing string (`Admin.fields.units.EUR`) is present in both
  `messages/en.json` and `messages/ro.json` (grepped both myself).
- Number display (DEC-007): AC5 explicitly requires values reach pages only through the existing
  `formatNumber`/`formatReportDate` path; no new formatting code is in Files changed, confirmed.
- No secrets in code or logs: FX-7, the AX-2 sentinel tests, and my own manual greps over the
  fixtures and FINDINGS all found nothing.
- No weakened or skipped tests: BB-1/BB-2 are additive; the BRD manifest/tests are unchanged and
  still pass; the catalogue-count assertions changed from 8→16 with a cited reason (new rows), not
  a weakening.
- No scope creep: the `find -newermt` scan of `lib/`, `components/`, `app/` for files touched since
  Phase A returned exactly the files HANDOVER lists under "Files changed" — nothing extra.

### Findings

No Critical findings.

- **Note N1** — `dev_minions/status.md`'s Story board still shows US-029 as "Ready" rather than
  reflecting the in-progress review/test round; this is a bookkeeping lag against the loop's own
  step ordering (status.md is normally updated at gate completion), not a code or test defect. Not
  blocking.
- **Note N2** — AC4's "sends `BVB_REQUEST_HEADERS`... plus only the headers a form post needs" is
  proven for the *absence* of form-post headers (`Content-Type`/`Cookie` asserted undefined in
  AX-1) but AX-1 does not assert the *presence* of `BVB_REQUEST_HEADERS`' actual header values on
  the page request or the PDF's own header set on the download request — that positive coverage
  already exists in the untouched `discovery.test.ts`/`pdf.test.ts`, so there is no gap in
  practice, just a slightly indirect proof path for this AC's specific wording. Not blocking.

### Files changed — cross-checked against HANDOVER.md's "Files changed (US-029, in flight)" list

Read every file on that list in full (or, for large spike/README files, the sections relevant to
this story). No file outside that list was found touched for this story (see the `find -newermt`
check above).

Denied or attempted commands: none.
