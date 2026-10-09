# US-017 — Plan: day-over-day delta calculation (absolute and percentage)
Planned by `story-planner`, 2026-09-25. Story: `backlog/stories/US-017.md` (including its
`## Tech-lead review 2026-09-25`). Builds on US-016 (Awaiting QA): `lib/monitoring/home.ts`,
`lib/format/number.ts`, `components/HomeTable.tsx`.

No new decision is needed. The story's two PRODUCT items (#6 "previous day" and #7 delta display
in sprint-04.md) are non-blocking. The story says "This story implements" option A for both, so this
plan implements option A and the PO confirms at the demo. The tech-lead review left the choice
between (a) "previous day in SQL" and (b) "second read" to this plan. It picks (a), see §4.

## 1. Acceptance criteria → tests

| AC | Restated | Proven by |
|---|---|---|
| AC1 | `computeDelta` absolute is exact, at the scale of the more precise input | `lib/monitoring/delta.test.ts`: `11.091`/`11.085` → `0.006`; `37470000`/`37500000` → `-30000`; `8640000.00`/`8639999.5` → `0.50`; `11.091`/`11.091` → `0.000`. Extra cases: negative inputs (`-10`/`-20` → `10`), a scale-0 minus scale-4 input (`5`/`4.9999` → `0.0001`), a large value (`415591664.27`/`415591664.26` → `0.01`). A source scan, in the same test file, proves `delta.ts` never calls `Number(`, `parseFloat`, `parseInt`, `toFixed`, `Math.`, `Intl`, `Date` or a unary `+` on an identifier or `(`. It has a positive control on a sample string, in the style of `lib/ingestion/boundaries.test.ts`. |
| AC2 | Percentage = (c−p)/\|p\|×100, exact, 2 decimals, half away from zero; `null` when p = 0 | `delta.test.ts`: `11.091`/`11.085` → `0.05`; `37470000`/`37500000` → `-0.08`; `1000.15`/`1000` → `0.02` (the exact tie); `999.85`/`1000` → `-0.02`; `5`/`0`, `5`/`0.000`, `0`/`0` → `percent: null` with the absolute still returned (`5`, `5.000`, `0`). Extra cases: rounded to zero, `1000.00004`/`1000` → `0.00` (never `-0.00`); `999.99996`/`1000` → `0.00`; negative denominator `-10`/`-20` → `50.00`. |
| AC3 | Previous day = calendar day before the shown report date; not dependent on the process time zone; proven through the read model too | Unit, `delta.test.ts`: `previousCalendarDay` on `2026-09-22`→`2026-09-21`, `2026-03-01`→`2026-02-28`, `2028-03-01`→`2028-02-29`, `2027-01-01`→`2026-12-31`, and `2100-03-01`→`2100-02-28` (a century year that is not a leap year). The cases run again with `process.env.TZ` set to `Pacific/Kiritimati` and `America/Los_Angeles`, restored in `afterEach`. The source scan (AC1) shows no `Date` use. Invalid input (`2026-02-30`, `20260922`) throws. **Read model**, new `lib/monitoring/home-delta.pglite.test.ts`: `ok` reports on `2026-02-28` and `2026-03-01` give a non-null exact delta on the `2026-03-01` row. So do `2026-12-31` and `2027-01-01`, and `2028-02-29` and `2028-03-01`. Negative control: `2026-02-27` and `2026-03-01` only → delta `null`. |
| AC4 | Delta blank, never guessed | `home-delta.pglite.test.ts`: (i) `ok` on 09-20 and 09-22, 09-21 missing → `delta: null`, `value` still present; (ii) 09-21 `parse_error` **with** a stored value for the field, 09-22 `ok` → `null`; (iii) 09-21 `ok` without the field, but with a second field → the first field is `null`, the second has a delta (so the test proves something); (iv) 09-22 `ok` without the field, 09-21 `ok` with it → `value: null`, `delta: null`; (v) consecutive `ok` days `11.085` → `11.091` → `{ absolute: "0.006", percent: "0.05" }`; (vi) previous stored value `0` → `{ absolute: <exact>, percent: null }`; (vii) a newer `parse_error` on 09-23 over `ok` 09-22 and `ok` 09-21 → the 09-22 value is compared with 09-21 (the day before the *shown* date). |
| AC5 | Sign from the displayed value; locale decimal mark; no grouping; `%` with no space | New `lib/format/delta.test.ts`: `ro` `0.006` → `+0,006`, `0.05` → `+0,05%`; `en` `-30000` → `-30000`, `-0.08` → `-0.08%`; `ro` `0.000` → `0,000`, `0.00` → `0,00%`; `ro` `-0.00` (a defensive input) → `0,00%`, never `-0,00%` or `+0,00%`; `1234567.89` shows no grouping character in either locale (same assertion style as `number.test.ts`). |
| AC6 | Home cell shows value, absolute, percentage; a `null` delta renders no text; new strings in both catalogues | `components/HomeTable.test.tsx`, for `ro` and `en`: a cell with both deltas (`ro` shows `11,091`, `+0,006`, `+0,05%`, in this order, found with `indexOf`); a cell with an absolute delta only (`percent: null`): no `%` in that `<td>`; a cell with `delta: null`: its `<td>` is exactly the formatted value, with no `+`, `-`, `%`, `0,00` or extra element. The new title keys render in the right locale and never in the other one. `i18n/messages.test.ts` (key parity) stays green. |
| AC7 | Offline: read-model tests use PGlite with the shipped statements | `home-delta.pglite.test.ts` uses `createTestDatabase()` and `createHomeTableLoader(db.mockDb, undefined, db.runner)`, the same statements the page runs. No new test touches `@neondatabase/serverless` or `DATABASE_URL`. |
| AC8 | Gates | `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Also `pnpm build` with `DATABASE_URL` unset (sprint DoD). |

MANUAL-QA (live, user): sprint-04.md step 3. It needs `ok` reports in Neon on two consecutive
calendar days. Pick one ETF and one field. Open the PDF for the shown date and the PDF for the day
before. Check by hand the absolute change (same digits as stored) and the percentage (2 decimals,
half away from zero), with the sign and the DEC-007 format in RO and EN. When the shown report is a
Sunday report, the delta is expected to be blank (decision 1, literal catch-up reading). Nothing else
in this story needs a live resource.

## 2. Files and boundaries

| File | Change | Boundary |
|---|---|---|
| `lib/monitoring/delta.ts` | **New.** `previousCalendarDay(iso)`, `isCanonicalDecimal(s)`, `computeDelta(current, previous)`, and the type `Delta = { absolute: string; percent: string \| null }` | Pure. No imports except types. No I/O, no `Date`, no float. It throws `RangeError` on non-canonical input. |
| `lib/monitoring/delta.test.ts` | **New.** AC1–AC3 unit tests plus the source scan | — |
| `lib/format/delta.ts` | **New.** `formatDeltaAbsolute(canonical, locale)` and `formatDeltaPercent(canonical, locale)` | Uses `formatNumber` (the only DEC-007 formatter). Adds the sign and the `%`. Does no arithmetic. |
| `lib/format/delta.test.ts` | **New.** AC5 tests | — |
| `lib/monitoring/home.ts` | **Edit.** Adds the fifth statement `buildPreviousDayOkValuesStatement`. Moves the "newest `ok` report per ETF" subquery into one private `sql` fragment used by both statements. `HomeCell` tracked variant gains `delta: Delta \| null`. `buildViewModel` fills it in. | Still read-only, and still one `BatchRunner` call. Delta arithmetic is delegated to `delta.ts`. |
| `lib/monitoring/home.pglite.test.ts` | **Edit, expectations only.** Four `toEqual({ tracked: true, value: … })` gain `delta: null` (true for these fixtures: no consecutive days). Do not switch to `toMatchObject`, and do not drop any assertion. | — |
| `lib/monitoring/home-delta.pglite.test.ts` | **New.** AC3 read-model boundaries and AC4 | — |
| `components/HomeTable.tsx` | **Edit.** A tracked cell with a value renders the value, then `<span title={t("deltaAbsolute")}>` and `<span title={t("deltaPercent")}>`, each only when present | Presentational. Only formats canonical strings from the view model, never computes. |
| `components/HomeTable.test.tsx` | **Edit.** Fixture cells gain `delta`. Adds the AC6 cases. | — |
| `app/page.test.tsx` | **Edit, fixture only.** The mocked cell gains `delta: null` (typecheck) | — |
| `messages/ro.json`, `messages/en.json` | **Edit.** `Home.deltaAbsolute` = "Variație absolută față de ziua anterioară" / "Absolute change vs. previous day". `Home.deltaPercent` = "Variație procentuală față de ziua anterioară" / "Percentage change vs. previous day". | The PO confirms the Romanian copy at the demo (US-004 precedent). |

No new dependency. No change to `app/page.tsx`: it already passes the view model through.

## 3. Data model
None. Read-only, no schema change, no migration (story Out of scope; sprint DoD).
`report_values.numeric_value` is unscaled `numeric`, so the stored scale (`8640000.00`) comes back
unchanged as a string from both Neon HTTP and PGlite. The US-016 PGlite tests already assert `"10.000"`.

## 4. Design

### 4.1 Previous day in SQL (option (a)), in the same batch
One more statement joins, for each ETF, the newest `ok` report (the same fragment as
`buildLatestOkValuesStatement`) to an `ok` report exactly one calendar day earlier:
```sql
select "latest"."etf_id", "prev"."report_date" as "previous_date", "rv"."field_key", "rv"."numeric_value"
from (<newest ok report per etf — shared fragment>) "latest"
join "reports" "prev" on "prev"."etf_id" = "latest"."etf_id"
                     and "prev"."report_date" = "latest"."report_date" - 1
                     and "prev"."status" = 'ok'
join "report_values" "rv" on "rv"."report_id" = "prev"."id"
order by "latest"."etf_id", "rv"."field_key"
```
In Postgres, `date - integer` is a `date`, so it has no time zone and handles month and year ends
natively. The statement depends only on data, not on another statement's result, so it goes in the
same `db.batch` as the other four (one round trip). `unique(etf_id, report_date)` guarantees at most
one previous report. A missing previous report, a `parse_error` one, or one without the field all
simply yield no row, and the result is `null`.

**Why `previousCalendarDay` is still on the production path:** `buildViewModel` uses the SQL rows only
when `toIsoDateString(previous_date) === previousCalendarDay(valueDate)`. This is a one-line invariant
check. The helper is therefore called on every page render, as the tech-lead review asked. If SQL and
helper ever disagreed, the delta would be blank, never wrong. The PGlite boundary tests (AC3) expect
non-null deltas, so such a disagreement would fail them rather than hide.

### 4.2 Cell assembly (`buildViewModel`)
For a tracked cell: `delta = null` unless all of these hold: `value !== null`; the previous-day map
has a non-null value for the field; the date invariant holds; `isCanonicalDecimal` is true for both
values. When they hold, `delta = computeDelta(value, previousValue)`. The canonical check means a
Postgres `NaN` (impossible under US-010's number pattern, but the column allows it) gives a blank
delta instead of a page-wide error.

### 4.3 Exact arithmetic (`delta.ts`)
- Parse `^-?\d+(\.\d+)?$` into `{ units: bigint, scale }`. Scale both inputs to `s = max(scale)`
  by appending zeros to the digit string. Never multiply a float.
- `absolute = format(c − p, s)`. Zero prints as `0.000` with no sign. The magnitude and the sign are
  handled separately, so `-0` cannot appear.
- `percent`: if `p == 0`, `null`. Otherwise `n = |c−p| × 10000`, `d = |p|`, `q = n / d`, `r = n % d`,
  `if (2r >= d) q += 1` (half away from zero on the magnitude). Format `q` with 2 decimals. Prefix
  `-` only when `c−p < 0` **and** `q > 0`, so a change that rounds to zero is `0.00`, never `-0.00`.
- `previousCalendarDay`: validate with the same rules as `isIsoCalendarDate` (in `validate.ts`,
  whose leap-year helper is private). Keep a small local `isLeapYear`/`daysInMonth` rather than
  export from the extraction module, so `monitoring` does not depend on `extraction/adapters`
  internals. Then day−1 → if 0, month−1 → if 0, year−1 and month 12; day = daysInMonth. Zero-pad
  the year to 4 digits.

### 4.4 Display
`formatDeltaAbsolute`: if the string has no non-zero digit, strip any leading `-` and add no sign.
Else if it starts with `-`, keep it. Else prefix `+`. Then `formatNumber(…, locale)`.
`formatDeltaPercent` = the same + `"%"`. Cell markup: `{value} <span …>{abs}</span> <span …>{pct}</span>`.
Visual stacking and spacing are left to Tailwind classes, not tested. Adding no colour is deliberate
(story Out of scope).

## 5. Risks
- **R1 — PGlite returns `previous_date` as a JS `Date`.** Use the existing `toIsoDateString` (UTC
  getters) before comparing. Without it, the invariant check fails in tests in time zones east of UTC.
- **R2 — Churn in US-016 tests.** Adding `delta` to `HomeCell` changes four `toEqual` expectations
  and two fixtures. That adapts the tests to an extended shape; it does not weaken them. Each edit
  only adds `delta: null` / `delta: {…}`. The reviewer should check that no assertion was removed or
  loosened.
- **R3 — Unary-plus scan false positives.** Restrict the regex to `[=(,:?]\s*\+\s*[A-Za-z_(]` and
  give it a positive control (`const x = +a;`) and a negative control (`a + b`, `"+"` string
  literals). The `"+"` sign prefix in `lib/format/delta.ts` is out of the scan's scope, which is
  `lib/monitoring/delta.ts` only.
- **R4 — Two definitions of "newest ok report".** If `buildLatestOkValuesStatement` and the new
  statement drifted apart, a delta could compare against the wrong base. The shared `sql` fragment
  removes that risk. Test (vii) in AC4 would catch a regression.
- **R5 — Leap-year and century rules.** Covered by `2028-03-01` and `2100-03-01` in the unit tests and
  by `2028-03-01` through PGlite.
- Smallest design: one pure module, one formatter file, one extra read-only statement in the existing
  batch, and a cell field. There is nothing here for an adapter or plugin to extend. If the PO picks
  option B for "previous day" at the demo, only the SQL join condition (`<` instead of `= … - 1`,
  newest first) and the invariant check change (story Decisions needed 1).

## 6. Decisions needed
None new. Non-blocking PRODUCT items already recorded in sprint-04.md and implemented here as the
story says: #6 "previous day" (option A) and #7 delta display (option A). Also for the PO's eye at
the demo (copy, not a decision): the Romanian wording of the two new `title` labels.
