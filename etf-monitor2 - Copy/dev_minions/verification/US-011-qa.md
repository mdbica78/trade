# US-011 QA checklist — Test fixtures: committed sample reports and adapter unit tests

Round 1: review PASS (`US-011-review.md`), tests PASS (`US-011-tests.md`, 387/387 total, 72 new
across `fixtures.test.ts` and `report-latest.test.ts`). No fix loop needed.

## Manual checks

1. **AC7 (MANUAL-QA).** On the user's machine:
   ```
   export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
   pnpm report:latest BTBETRETF
   pnpm report:latest TVBETETF
   pnpm report:latest PTENGETF
   ```
   For each, confirm:
   - it prints a bvb.ro PDF URL, a report date and eight values;
   - the URL is the newest depositary report in the instrument page's "Știri" tab;
   - the values match that PDF opened in a browser.

   This also covers US-007's live behaviour (retires that story's interim manual browser check).

2. **PO to confirm `expected.json`** by spot-checking one entry (e.g. TVBETETF-2026-09-22) against
   the PDF opened in a browser — the implementer's own transcription was cross-checked against
   `spikes/pdf-extraction/compare.mjs`'s independent `pdf-parse` output, and the reviewer
   independently re-ran that same script and hand-verified all three 2026-09-22 entries against
   it (see `US-011-review.md`), but the manifest itself is not agent-drafted acceptance criteria
   — it's data, worth one human glance.

3. Task 5 (new live fixtures) succeeded: bvb.ro was reachable from this session, so
   `BTBETRETF-2026-09-22.pdf`, `TVBETETF-2026-09-22.pdf` and `PTENGETF-2026-09-22.pdf` were
   captured via `pnpm report:latest <SYMBOL> --save` and added to the manifest (6 fixtures
   total now, up from 3). No live Neon/Vercel step — this story persists nothing.

## Non-blocking review notes (fix later if this file is touched again, not blocking QA)

- `US-011-tests.md`'s descriptive text still says "3 fixtures, all dated 2026-09-21" even though
  the manifest now has 6 (Task 5 added three 2026-09-22 fixtures after the tester's initial pass
  wording was drafted) — its test counts (387/72) are correct, just the prose is stale. Cosmetic.
- `report:latest`'s printed output is plain, comma-formatted numbers with no next-intl/DEC-007
  formatting — correct and intentional: it's a developer CLI, not UI (same precedent as
  `db:seed`).

## Files changed

- `test/fixtures/expected.json` (new — 6 entries: 3 committed 2026-09-21 + 3 live-captured 2026-09-22)
- `test/fixtures/README.md` (new)
- `test/fixtures/BTBETRETF-2026-09-22.pdf`, `test/fixtures/TVBETETF-2026-09-22.pdf`, `test/fixtures/PTENGETF-2026-09-22.pdf` (new — Task 5, live capture)
- `lib/extraction/fixtures.test.ts` (new)
- `lib/extraction/report-latest.ts` (new)
- `lib/extraction/report-latest.test.ts` (new)
- `scripts/report-latest.ts` (new)
- `package.json` (changed — `report:latest` script)
