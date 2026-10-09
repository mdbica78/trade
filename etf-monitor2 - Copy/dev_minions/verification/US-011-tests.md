# US-011 — Test fixtures (verification)

## Round 1 — 2026-09-24

Verdict: PASS

All acceptance criteria covered by tests; all tests green.

### Command results

| Command | Exit code | Notes |
|---------|-----------|-------|
| `pnpm install` | 0 | Already up to date |
| `pnpm typecheck` | 0 | No errors |
| `pnpm lint` | 0 | 1 warning (unused `_text` param in test, non-blocking) |
| `pnpm test` | 0 | 387 tests pass (49 in fixtures.test.ts, 23 in report-latest.test.ts, 315 from prior stories) |
| `pnpm build` | 0 | Next.js build successful |

### Acceptance criteria mapping

| AC | Criterion | Test names | Status |
|----|-----------|-----------  |--------|
| AC1 | Manifest has entries for every PDF with correct values and source; BTBETRETF table matches Task 1 | "manifest shape (AC1)" › "is not vacuous", "has all fieldKeys, valid reportDate, consistent naming", "has no duplicate file names", "BTBETRETF-2026-09-21 entry equals the story's Task 1 table" | PASS (6 tests) |
| AC2 | Regression suite passes offline; PDF → text → adapter yields exactly manifest values, no missing field, no violations | "PDF -> text -> adapter pipeline (AC2, AC4, AC5)" › "never touches the network", per-fixture "adapter extracts exactly the manifest's date and values, no missing field, no violation (AC2)" (3 fixtures) | PASS (4 tests) |
| AC3 | Suite fails when PDF has no manifest entry and vice versa; proven by temporary changes | "fixture manifest and PDFs stay in sync" › "every PDF in test/fixtures/ has a manifest entry (AC3)", "every manifest entry has a PDF (AC3)", "diffFixtureSets helper (AC3 synthetic checks)" with 3 synthetic test cases | PASS (5 tests) |
| AC4 | Units breakdown and investors breakdown sums are exact for every fixture | "consistency checks (AC4)" › per-fixture "pipeline: units breakdown sums...", "manifest: units breakdown sums...", plus helper "sumsExactly" with 4 test cases (3 fixtures × 2 assertions + 4 helpers) | PASS (10 tests) |
| AC5 | `detect(text)` returns brd-depositary adapter for every fixture | "PDF -> text -> adapter pipeline (AC2, AC4, AC5)" › per-fixture "detect(text) returns the brd-depositary adapter (AC5)" (3 fixtures) | PASS (3 tests) |
| AC6 | `report:latest` logic unit-tested with mocks: success returns URL/date/values; failures give clear messages and non-zero exit; `--save` writes file with date from PDF and refuses overwrite; no DB access | "runReportLatest: success" (2 tests), "runReportLatest: failures" (9 tests for symbol/discovery/not_found/download/extract/adapter/violation/usage/partial), "runReportLatest: --save" (2 tests), "defaultWriteFileExclusive" (1 test), "no DB access (AC6)" (1 test) | PASS (15 tests) |
| AC7 | MANUAL-QA: live test on user's machine | Not a test criterion | MANUAL-QA |
| AC8 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass | All 4 commands pass (see table above); offline smoke check via `pnpm report:latest` is part of AC6 tests | PASS |

### Notes

- Test file structure matches the plan: `lib/extraction/fixtures.test.ts` (49 tests for AC1–AC5) and `lib/extraction/report-latest.test.ts` (23 tests for AC6).
- All three committed PDF fixtures (BTBETRETF, TVBETETF, PTENGETF, all dated 2026-09-21) are exercised throughout.
- The lint warning about unused `_text` is in `lib/extraction/adapters/types.test.ts`, a prior story's test file, not new in this round.
- AC3 temporary-change proof (copying PDF, adding stale manifest entry) is documented in the plan under "Implementation notes — AC3 proof" with observed failure messages; the implementer confirmed the tree returned to its original state.
- No uncovered criteria.
