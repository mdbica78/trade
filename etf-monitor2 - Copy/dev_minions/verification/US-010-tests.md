# US-010 test verdict

**Story:** US-010 — BRD depositary adapter (units in circulation, net asset, VUAN, investor counts)
**Round:** 1
**Date:** 2026-09-23

## Verdict: PASS

All commands exited 0, all acceptance criteria covered by tests with no UNCOVERED or MANUAL-QA.

## Commands

| Command | Exit code | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | Completed in 392ms |
| `pnpm typecheck` | 0 | No errors |
| `pnpm lint` | 0 | 1 warning in unrelated file (US-009's types.test.ts, pre-existing) |
| `pnpm test` | 0 | 315 tests passed (53 in brd-depositary.test.ts, 25 in numbers.test.ts, others unchanged) |
| `pnpm build` | 0 | Production build compiled successfully with webpack |

## Acceptance criteria mapping

| AC | Criterion | Test file | Test name(s) |
|---|---|---|---|
| AC1 | Adapter key is `brd-depositary`; `fieldKeys` equals exactly the seeded catalogue's brd-depositary fields | `lib/extraction/adapters/brd-depositary.test.ts` | `identity (AC1)` › `key is brd-depositary`; `fieldKeys equal exactly the seeded catalogue's brd-depositary field keys` |
| AC2 | Default registry returns adapter by identity; every `adapterKey` in `seedEtfs` resolves | `lib/extraction/adapters/brd-depositary.test.ts` | `registration (AC2)` › `the default registry returns this adapter by identity`; `$symbol's adapterKey resolves to a registered adapter` (3 seeded ETFs); `detect resolves BRD-format text to this adapter` |
| AC3 | Report date extracted from footer `Raport depozitar la data de 21.09.2026`, not the filing stamp; missing footer gives `ok: false` | `lib/extraction/adapters/brd-depositary.test.ts` | `report date (AC3)` › all 8 tests covering default, no footer, invalid dates, non-date token, whitespace tolerance, duplicate same/different dates |
| AC4 | Values extracted correctly (net_asset, units_in_circulation, units_held_individuals, units_held_legal_entities, investors_total, investors_individuals, investors_legal_entities); label-based not positional | `lib/extraction/adapters/brd-depositary.test.ts` | `values (AC4)` › `nav_per_unit is 11.091`; `missingFields is empty on the full default text`; `swapping the order of the two ACTIV NET lines still gives the correct net_asset (label-based, not positional)`; `values come out in fieldKeys order` + `it.each` on field table |
| AC5 | VUAN positioned between legal entities value and investors label; missing when label absent, gap empty, or gap holds multiple numbers | `lib/extraction/adapters/brd-depositary.test.ts` | `VUAN (AC5)` › 8 tests covering default, missing label, no number in gap, multiple numbers, non-number, rejected format, extra tokens, moved label |
| AC6 | Number parser accepts comma-thousands/dot-decimal format (7 valid examples), rejects ro-format/malformed/signed/partial; rejected tokens missing in adapter | `lib/extraction/adapters/numbers.test.ts` | `parseReportNumber (AC6)` › `it.each` 7 accept cases, `it.each` 18 reject cases; `lib/extraction/adapters/brd-depositary.test.ts` › `rejected token (AC6, adapter half)` › 2 tests |
| AC7 | Removing a label makes its dependent fields missing without borrowing from other blocks | `lib/extraction/adapters/brd-depositary.test.ts` | `label removal (AC7)` › 8 tests covering each removal case (navFundLabel, units/investors sub-labels, parent labels) + metacharacter escaping |
| AC8 | `canHandle` true for BRD text, false for unrelated (VAN variant, missing labels, empty, unrelated); all results pass `validateExtractionResult` | `lib/extraction/adapters/brd-depositary.test.ts` | `canHandle (AC8)` › 8 tests; all extract calls wrapped in `run()` which asserts validation passes |
| AC9 | Pure function: no AI, network, DB, PDF-library import; no state leakage between calls | `lib/extraction/adapters/brd-depositary.test.ts` | `purity (AC9)` › `A-B-A: extract does not leak state between calls`; verified by review: imports only types, validate, numbers; no `fetch`, `process.env`, `Date`, `Math.random` |
| AC10 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass | — | All four commands above exited 0; build imports default-registry.ts confirming no duplicate keys or repeated fieldKeys |

## Coverage summary

- Total test files involved: 2 new (numbers.test.ts, brd-depositary.test.ts) + unchanged registry.test.ts and boundaries.test.ts which now cover 6 adapter files
- New tests: 53 (brd-depositary) + 25 (numbers) = 78 new tests, all passing
- Test framework: Vitest
- No UNCOVERED criteria, no MANUAL-QA criteria
- All source files (numbers.ts, brd-depositary.ts, default-registry.ts) present and integrated

## Notes

- One pre-existing lint warning in `lib/extraction/adapters/types.test.ts` (unused `_text` variable from US-009) does not block the build or tests.
- The 7 `seedEtfs` tests in AC2's `it.each` verify all three seeded BRD ETFs (BTBETRETF, TVBETETF, PTENGETF).
- AC9 purity verified both by test (A-B-A state test) and by review of imports (no external IO).
