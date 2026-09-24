# US-010 QA checklist — BRD depositary adapter

Round 1: review PASS, tests PASS (315/315 incl. 80 new). No fix loop needed.

Acceptance criteria AC1-AC10 are the story's own (not agent-drafted — `backlog/stories/US-010.md`
already had them, with a tech-lead fix at detail time), so no PO confirmation of criteria wording
is needed here.

## Manual checks

None required for this story specifically — it's pure text-in/struct-out. As part of implementing
it, an (optional, not committed) smoke check ran the adapter against all three real committed PDF
fixtures through `extractPdfText`: all three gave `reportDate: "2026-09-21"`, all 8 values found,
zero `missingFields`, zero `validateExtractionResult` violations. The full fixture-suite regression
test and the live end-to-end check are US-011 (AC2, AC7).

## Non-blocking notes

- The investors label is searched from position 0 rather than from the units label's end as the
  plan's design sketch suggested — harmless, every downstream use is guarded by a position-ordering
  check and no test exposes a behavioural difference.
- `canHandle` hardcodes `"NUMAR U.F. in circulatie"` as a separate literal from `LABELS.units`
  rather than deriving it — matches the story's own wording, minor duplication only.

## Files changed

- `lib/extraction/adapters/numbers.ts` (new)
- `lib/extraction/adapters/numbers.test.ts` (new)
- `lib/extraction/adapters/brd-depositary.ts` (new)
- `lib/extraction/adapters/brd-depositary.test.ts` (new)
- `lib/extraction/adapters/default-registry.ts` (changed — registers `brdDepositaryAdapter`)
