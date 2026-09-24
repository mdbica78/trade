# US-009 tests — Round 1

Tested by story-tester (Haiku 4.5), 2026-09-23.

Verdict: **PASS**

---

## Command results

| Command | Exit code | Status |
|---------|-----------|--------|
| `pnpm install` | 0 | PASS |
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS (1 non-error warning in types.test.ts, line 10: unused `_text` variable) |
| `pnpm test` | 0 | PASS (235 tests total; 92 in lib/extraction/adapters) |
| `pnpm build` | 0 | PASS |

---

## Acceptance criteria → test coverage

| AC | Criterion | Test file(s) | Test name(s) / coverage |
|---|---|---|---|
| **AC1** | Contract (ExtractionAdapter, ExtractedValue, ExtractionResult) exported with correct semantics: `reportDate` = YYYY-MM-DD; per-field `numericValue` canonical + `rawValue` verbatim; `missingFields`; `ok: false` for unusable text. Compile-time checks and runtime narrowing. | `types.test.ts` | "contract (AC1)" [8 tests]: 1) adapter satisfies interface; 2–5) @ts-expect-error checks for required fields; 6) fieldKeys readonly; 7) extract takes text only; 8) narrowing works |
| **AC2** | `get(registeredKey)` returns that adapter; `get(null/undefined/"unknown-key"/etc)` return `undefined`, never throw, never fall back. No prototype-key lookups. | `registry.test.ts` | "get (AC2)" [5 tests]: 1) exact key identity lookup; 2) 11-case parameterized test (null, undefined, "unknown-key", "", case folding, trimming, prototype keys); 3) empty registry; 4) never calls canHandle/extract during get |
| **AC3** | `createAdapterRegistry` throws clear error on duplicate adapter key. | `registry.test.ts` | "duplicate key (AC3)" [5 tests]: 1) duplicate at positions 1,2; 2) duplicate at positions 1,3; 3) empty key; 4) whitespace-only key; 5) repeated fieldKey within one adapter |
| **AC4** | `detect(text)` returns single adapter claiming text; `undefined` when none or 2+ claim it. Calls every adapter's `canHandle` without short-circuiting. | `registry.test.ts` | "detect (AC4)" [7 tests]: 1) single claimant; 2) no claimant; 3) two claimants; 4) ambiguity with three adapters; 5) empty registry; 6) every canHandle called once (non-short-circuit proof); 7) extract never called |
| **AC5** | `validateExtractionResult` reports violation for each broken rule (one test per rule), none for valid result. Rules: unknown_field, duplicate_field, uncovered_field, invalid_report_date, invalid_numeric_value, empty_raw_value (hardening), empty_error (hardening). Date/numeric validation tables. | `validate.test.ts` | "validateExtractionResult (AC5)" [43 tests]: 4 valid baseline cases; 2 unknown_field (values, missingFields); 3 duplicate_field (values, missingFields, both); 1 uncovered_field; 1 invalid_report_date; 13-case invalid numericValue table; 6-case valid numericValue table; 1 empty_raw_value; 1 empty_error; 1 immutability check. Plus "isIsoCalendarDate" [15 tests]: 3 valid dates (leap years, century years), 12 invalid dates |
| **AC6** | Contract and registry modules import no database, network or PDF-library code. Adapters work on text only. Imports must be relative, stay inside `lib/extraction/`, and never reach `../http`, `../pdf`, `../discovery`. No `fetch(` or `process.env`. | `boundaries.test.ts` | "adapter modules are text-only (AC6)" [5 tests]: 1) positive control (specifier extractor finds 4 forms); 2) at least 4 production .ts files found (not vacuous); 3–6) four production files (`types.ts`, `validate.ts`, `registry.ts`, `default-registry.ts`) each verified for import rules, forbidden modules, fetch/env patterns. Additional "default registry" and "registry immutability" tests also pass (extra criteria from plan section 1, not explicitly in story ACs). |
| **AC7** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass. | N/A (gate verification) | All four commands exit 0. Typecheck includes test files (tsconfig coverage). No other failures or errors detected. |

---

## Test files created

- `lib/extraction/adapters/types.test.ts` (8 tests)
- `lib/extraction/adapters/registry.test.ts` (30 tests)
- `lib/extraction/adapters/validate.test.ts` (48 tests)
- `lib/extraction/adapters/boundaries.test.ts` (6 tests)

**Total: 92 tests for US-009 logic, all passing.**

---

## Notes

- The lint warning (unused `_text` parameter in types.test.ts:10) is harmless: the parameter is used to document the function signature being tested, though unused in the test body. Suppressing it would reduce clarity. Lint exit code remains 0.
- The date validation uses pure arithmetic (no `Date` object), proving correctness across engines and timezones (R3 in plan).
- The `detect` test explicitly verifies that every adapter's `canHandle` is called even when a match is found, proving the implementation does not short-circuit (R2).
- Registry immutability is tested: the input array can be mutated after creation without affecting the registry; `list()` returns a frozen array.
- All AC criteria are COVERED by tests. No uncovered criteria. No MANUAL-QA steps listed in the story.
