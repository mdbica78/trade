# US-007 QA checklist — Report discovery: find the latest report link on a BVB instrument page

Round 1: review PASS (`US-007-review.md`), tests PASS (`US-007-tests.md`, 104/104 incl. 48 new). No fix loop needed.

Acceptance criteria AC1-AC8 are all agent-drafted from FR3/FR4.1/FR7/FR13 by `story-planner` and confirmed
against the story (`backlog/stories/US-007.md`) — **PO to confirm at the demo**, per the story's own header.

## Manual checks

1. **PO confirms the drafted acceptance criteria** (AC1–AC8 in `backlog/stories/US-007.md`) still match
   intent — nothing here changes product behaviour, it is the first discovery module and has no UI.
2. **Live browser check** (until US-011 wires up `pnpm report:latest <SYMBOL>`, per the story's MANUAL-QA
   note): open each of these URLs in a browser, go to the "Știri" tab, and confirm the newest depositary
   report's PDF link matches the table below **for the fixture's capture date (2026-09-23)**. If newer
   reports have since appeared, confirm the fixture's entry is still listed with the same date/link.

   | Symbol | Page | Expected newest PDF (as of 2026-09-23) |
   |---|---|---|
   | BTBETRETF | https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF | https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf |
   | TVBETETF | https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=TVBETETF | https://bvb.ro/infocont/infocont26/TVBETETF_20260923090730_VUAN-ETF-BET-Patria---Tradeville-22-09-2026.pdf |
   | PTENGETF | https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=PTENGETF | https://bvb.ro/infocont/infocont26/PTENGETF_20260923090816_VUAN-ETF-Energie-Patria-Tradeville-22-09-2026.pdf |

3. No live Neon/Vercel/AI-provider step — this story only reads bvb.ro and persists nothing (Sprint 3 wires
   ingestion). No env vars, no deploy.

## Non-blocking review notes (fix later if this file is touched again, not blocking QA)

- `test/fixtures/bvb/README.md` byte-size table is off by +9 per file vs the actual files on disk
  (JS string `.length` counted UTF-16 code units, not UTF-8 bytes — content itself is correct and matches
  the tests). Cosmetic only.
- `discoverLatestReport` parses the HTML twice internally (once for the `listFound` check, once inside
  `findLatestReportLink`). Harmless duplication, not a correctness issue.
- The `list_not_found` branch of `discoverLatestReport` isn't exercised end-to-end through a mocked fetch
  round trip (only via `parseReportList`/`findLatestReportLink` directly). Low risk, worth adding if this
  file is touched again.

## Files changed

- `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html`, `TVBETETF-instrument-2026-09-23.html`, `PTENGETF-instrument-2026-09-23.html` (new — captured live via documented headers)
- `test/fixtures/bvb/README.md` (new)
- `lib/extraction/http.ts` (new)
- `lib/extraction/html.ts` (new)
- `lib/extraction/discovery.ts` (new)
- `lib/extraction/http.test.ts`, `lib/extraction/html.test.ts`, `lib/extraction/discovery.test.ts` (new)
- `lib/extraction/.gitkeep` (deleted)
