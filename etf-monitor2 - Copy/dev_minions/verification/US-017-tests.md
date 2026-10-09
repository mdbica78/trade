# US-017 — Test Verdict Round 1
**Story:** Day-over-day delta calculation (absolute and percentage)  
**Tester:** Claude Haiku 4.5 (story-tester subagent)  
**Date:** 2026-09-25

---

## Verdict: PASS

All acceptance criteria are covered by tests, and all gates pass.

---

## Gate Results

| Gate | Exit Code | Status |
|---|---|---|
| `pnpm install` | 0 | PASS |
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS (3 non-blocking warnings: unused test params in unrelated files) |
| `pnpm test` | 0 | PASS (706/706 tests, 52 test files) |
| `pnpm build` | 0 | PASS |
| `pnpm build` (DATABASE_URL unset) | 0 | PASS |

---

## Acceptance Criteria → Test Coverage

| AC | Criterion | Proven by | Status |
|---|---|---|---|
| **AC1** | Absolute delta is exact at scale of more precise input | `lib/monitoring/delta.test.ts` suite "computeDelta absolute (AC1)" (7 cases: `11.091`/`11.085` → `0.006`; `37470000`/`37500000` → `-30000`; `8640000.00`/`8639999.5` → `0.50`; `11.091`/`11.091` → `0.000`; negative; scale mismatch; large values). Source scan confirms no `Number`, `parseFloat`, `toFixed`, `Math`, `Intl`, `Date`, or unary `+` on arithmetic path. | MET |
| **AC2** | Percentage exact, rounded 2 decimals, half away from zero; `null` when previous = 0 | `lib/monitoring/delta.test.ts` suite "computeDelta percent (AC2)" (8 cases: `11.091`/`11.085` → `0.05`; `37470000`/`37500000` → `-0.08`; `1000.15`/`1000` → `0.02` exact tie; `999.85`/`1000` → `-0.02`; division by zero; rounds to zero; negative denominator). | MET |
| **AC3** | Previous day = calendar day before; timezone-independent; PGlite test proves same boundary through read model | `lib/monitoring/delta.test.ts` "previousCalendarDay (AC3)" (5 unit cases: `2026-09-22`→`2026-09-21`, `2026-03-01`→`2026-02-28`, `2028-03-01`→`2028-02-29` leap year, `2027-01-01`→`2026-12-31`, `2100-03-01`→`2100-02-28` century non-leap). Timezone independence tested under `TZ=Pacific/Kiritimati` and `TZ=America/Los_Angeles`. Plus `lib/monitoring/home-delta.pglite.test.ts` (4 tests: month/year/leap-year boundaries via PGlite SQL `date - 1`; negative control gap > 1 day). | MET |
| **AC4** | Delta blank (never guessed); PGlite tests for all null cases | `lib/monitoring/home-delta.pglite.test.ts` suite "createHomeTableLoader delta (US-017 AC3/AC4)" (7 PGlite tests: (i) missing previous day; (ii) previous day `parse_error` with stored value; (iii) previous `ok` missing field; (iv) current value null; (v) consecutive `ok` days exact difference; (vi) previous value 0; (vii) newer `parse_error` ignored). | MET |
| **AC5** | Display: sign from displayed value, locale decimal mark, no grouping, `%` no space; zero shows no sign | `lib/format/delta.test.ts` (10 cases: `ro` `+0,006`, `en` `-30000`, zero no sign, defensive `-0.00` never shows signed zero, no grouping on 1234567.89, `%` no space). | MET |
| **AC6** | Home cell shows value, absolute, percentage; null delta renders no text; new strings in both catalogues | `components/HomeTable.test.tsx` suite "HomeTable deltas (US-017 AC6)" (4 tests: ro/en cell with both deltas (value then absolute then percentage order); absolute only (no `%`); null delta (no `+`, `-`, `%`, `0,00`); both title labels render in correct locale, not the other). `messages/ro.json` and `messages/en.json` both contain `Home.deltaAbsolute` and `Home.deltaPercent` keys. | MET |
| **AC7** | Offline: read-model tests use PGlite with shipped statements, no live Neon | `lib/monitoring/home-delta.pglite.test.ts` uses `createTestDatabase()` and `createHomeTableLoader(db.mockDb, undefined, db.runner)` with shipped SQL statements. No test imports `@neondatabase/serverless` or reads `DATABASE_URL`. | MET |
| **AC8** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass | All four commands exit 0 (see Gate Results above). | MET |

---

## Test Files Added/Modified

| File | Tests | Status |
|---|---|---|
| `lib/monitoring/delta.test.ts` | 20 unit tests (AC1, AC2, AC3 + source scan) | PASS |
| `lib/format/delta.test.ts` | 10 tests (AC5 formatters) | PASS |
| `lib/monitoring/home-delta.pglite.test.ts` | 11 PGlite tests (AC3/AC4 read model) | PASS |
| `components/HomeTable.test.tsx` | 4 new tests in "HomeTable deltas (AC6)" suite | PASS |
| `lib/monitoring/home.pglite.test.ts` | 12 tests (existing; 4 updated with `delta: null` field) | PASS |
| `app/page.test.tsx` | Fixture updated with `delta: null` | PASS |

---

## Notes

- All 706 tests across 52 files pass, including 11 new home-delta PGlite tests with up to ~44s execution time (realistic database I/O under PGlite).
- The source scan in `delta.test.ts` (AC1) successfully validates the arithmetic boundary: the file has no float conversion, no Math functions (except plain `Math.max` on integer scales), no Date parsing, and no unary `+` on the computation path.
- Both messages catalogues (`ro.json`, `en.json`) correctly define the new delta title labels.
- Lint exits 0; the 3 warnings (unused `_text` / `_deps` / `_statements` parameters in unrelated test files) are non-blocking and predate this story.
- AC3's timezone tests confirm `previousCalendarDay` results do not depend on `process.env.TZ`, protecting against silent day-off-by-one errors in different timezones.
- AC4 PGlite tests verify the full read model (SQL date arithmetic + TypeScript cell assembly) against realistic boundaries and edge cases.

---

## Summary

Round 1: **PASS** — no fixes needed. All gates exit 0. All 8 acceptance criteria are independently verified by dedicated test suites covering unit logic, read-model SQL boundaries, display formatting, and integration with the home table. No criterion is UNCOVERED.

