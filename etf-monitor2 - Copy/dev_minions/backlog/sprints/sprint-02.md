# Sprint 2 — Extraction core

> Detailed by agent (story-planner), 2026-09-23 — PO to confirm at demo.

**Epic:** EPIC-02
**Status:** see the `status.md` Story board
**Blocked by:** nothing. Sprint 1 stories are Done or Awaiting QA, which satisfies every dependency below (AGENTS.md, delivery loop step 1).

## Goal

Given an ETF, produce correct field values from its latest report, proven against committed fixtures (roadmap, Sprint 2; EPIC-02 "Done when").

Concretely: for each of the three BRD-format ETFs, the code can (1) find the latest depositary report link on the bvb.ro instrument page, (2) download the PDF and extract its text, (3) pick the matching extraction adapter from a registry, and (4) turn the text into the report date plus the eight catalogue fields seeded by US-005. All of it is proven offline by `pnpm test` against committed HTML and PDF fixtures. Nothing is persisted yet: persistence, cron and failure bookkeeping are Sprint 3 (EPIC-03).

## Why this order

- **US-007 first** because it carries the sprint's only live unknown: the HTML structure of the bvb.ro instrument page and where the "Știri" report links sit in it. US-001 downloaded the PDFs by hand, so nobody has yet looked at the page the way server code will. If the list turns out to need an ASP.NET postback or an XHR call, that is found out on day one while US-008…US-010 go ahead in parallel. If the page can only be read with a headless browser, that is a framework-level dependency and needs a DEC (AGENTS.md, "New runtime dependency"); only US-007 and US-011 would wait on it.
- **US-008** is independent of US-007 (it takes a URL) and puts `unpdf` (ADR-001) into the app.
- **US-009 before US-010**: the adapter contract and registry are the extension point the requirements insist on (section 3, "a system of adapters per report format"). Defining it with a fake adapter first keeps the BRD adapter from shaping the interface around its own quirks.
- **US-010** implements the BRD rules documented by the US-001 spike (`spikes/pdf-extraction/FINDINGS.md`), tested on text, with no PDF I/O.
- **US-011 last** because it joins everything: PDF fixtures → `unpdf` text → registry → adapter → expected values, plus the `pnpm report:latest` tool used for the live manual check and for capturing new fixtures.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-007 | Report discovery: find the latest report link on a BVB instrument page | US-002 | mid model, medium thinking. Complex (8 ACs, live investigation) → `story-planner` plan |
| US-008 | PDF download and text extraction service | US-002 | cheap model, low thinking. Plan in-session |
| US-009 | Adapter interface and registry | US-005 | strong model, high thinking. Complex (adapter framework) → `story-planner` plan |
| US-010 | BRD depositary adapter (units in circulation, net asset, VUAN, investor counts) | US-009 | strong model, high thinking. Complex (adapter framework, 10 ACs) → `story-planner` plan |
| US-011 | Test fixtures: committed sample reports and adapter unit tests | US-007, US-008, US-010 | mid model, medium thinking. Complex (8 ACs) → `story-planner` plan |

## Sprint Definition of Done

- All five stories reviewed and tested (PASS/PASS), Awaiting QA, then accepted by the user.
- `pnpm test` runs fully offline and proves:
  - discovery returns the expected latest report URL from each committed instrument-page HTML fixture (US-007);
  - `unpdf` text extraction works on every committed PDF fixture (US-008);
  - the registry resolves `brd-depositary` for all three seeded ETFs, and an unknown or null adapter key resolves to "no adapter" (US-009, US-010);
  - the BRD adapter yields the correct report date and all eight fields for every committed PDF fixture (US-011).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- No database writes, no UI, no cron in this sprint.
- The user has run `pnpm report:latest` live for the three ETFs, and the values matched the PDFs (manual QA below).

## Manual QA the user must perform in this sprint

No Neon or Vercel step in this sprint. All steps run locally in WSL, from the repo root.

1. **Fixture expectations.** Open `test/fixtures/BTBETRETF-2026-09-21.pdf`, `TVBETETF-2026-09-21.pdf` and `PTENGETF-2026-09-21.pdf`. Compare the report date (footer line "Raport depozitar la data de …") and the eight values with the expected-values manifest added by US-011. They must match exactly.
2. **Live latest report** (needs bvb.ro access through the corporate proxy, DEC-002):
   `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm report:latest BTBETRETF`
   Repeat for `TVBETETF` and `PTENGETF`. Expected: a bvb.ro PDF URL, a report date, and eight values for each. Open the printed URL in a browser and check that (a) it is the newest depositary report in the "Știri" tab of the instrument page and (b) the printed values match the PDF.
3. **Optional fresh fixture:** `pnpm report:latest BTBETRETF --save` writes `test/fixtures/BTBETRETF-<reportDate>.pdf`. The regression suite then fails until the file has a manifest entry (by design, US-011 AC3). Ask the agent to add the entry, or delete the file.
4. **Contingency, only if US-007 is Blocked because the agent's sandbox could not reach bvb.ro:** capture the three instrument pages yourself and tell the agent to continue:
   `curl -sL 'https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF' -o test/fixtures/bvb/BTBETRETF-instrument-$(date +%F).html`
   (same for TVBETETF and PTENGETF, with `NODE_EXTRA_CA_CERTS`/curl CA settings as in DEC-002 if curl complains about certificates).
5. **PO confirmation:** every story in this sprint was drafted by an agent. Confirm or correct the acceptance criteria at the demo.

## Notes for whoever details Sprint 3 (forward flags, not Sprint 2 scope)

- **DEC-010 binding note 2** applies to US-012: a `reports` row with `status = 'ok'` and its `report_values` must not be written by two independent HTTP-driver calls. US-012's plan must say which of the three allowed patterns it uses.
- The US-009 adapter contract returns **every** field the adapter can extract. FR3 says "extracts the selected parameters". Whether ingestion persists only tracked fields or all catalogue fields is still open. It becomes a `PRODUCT` decision when Sprint 3 is detailed: storing all fields would give history to a field the user starts tracking later.
- The adapter reports fields it could not find (`missingFields`) and never guesses. How a partial extraction maps onto `reports.status` (`ok` / `parse_error`) is US-014's call.
- `unpdf` is first bundled into a Next.js server route in Sprint 3 (cron endpoint). If `pnpm build` or the route fails on it, `serverExternalPackages` in `next.config.ts` is the first thing to try.
- Sprint 1 audit N2: set `timeZone` in `i18n/request.ts` before the first story that formats dates.
- Sprint 1 audit warnings W1–W6 are follow-ups on Sprint 1 files. None of them is in this sprint's roadmap titles, so they are not included here. They stay with the orchestrator/PO.
