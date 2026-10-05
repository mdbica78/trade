/**
 * Exact day-over-day delta arithmetic on canonical decimal strings (US-017). No `Number`,
 * `parseFloat`, `toFixed`, `Math`, `Intl` or `Date` on the arithmetic path — `report_values
 * .numeric_value` reaches the app as an exact string, and floats would silently corrupt it
 * (`11.091 - 11.085` is `0.005999999999999339` in IEEE-754). All arithmetic below is on
 * `bigint` digit strings.
 */

import { divideHalfUp, formatSigned, parseCanonical, rescale, subtract, ZERO } from "./exact-decimal";

export { isCanonicalDecimal } from "./exact-decimal";
export type Delta = { absolute: string; percent: string | null };

// `10n`-style BigInt literals need `target >= ES2020` (this repo's tsconfig targets ES2017,
// DEC-008), so every BigInt constant below goes through `BigInt(...)` instead.
const TEN_THOUSAND = BigInt(10000);

/**
 * `current` and `previous` are canonical decimal strings (`report_values.numeric_value`, US-010).
 * Throws `RangeError` on a non-canonical input — the caller (`buildViewModel`) checks
 * `isCanonicalDecimal` first and returns `delta: null` instead of calling this on bad input.
 * The percent is `null` when `previous` is zero; otherwise it is `|diff| / |previous| * 100`,
 * rounded to 2 decimals half away from zero (US-017 AC1/AC2/decision 2). `formatSigned` already
 * prints zero without a sign, so a change that rounds to zero is always `"0.00"`, never `"-0.00"`.
 */
export function computeDelta(current: string, previous: string): Delta {
  const currentScaled = parseCanonical(current);
  const previousScaled = parseCanonical(previous);
  const { difference, scale } = subtract(currentScaled, previousScaled);
  const magnitude = difference < ZERO ? -difference : difference;
  const negative = difference < ZERO;

  let percent: string | null = null;
  if (previousScaled.digits !== ZERO) {
    const previousScaledToDiffScale = rescale(previousScaled, scale);
    const previousMagnitude = previousScaledToDiffScale < ZERO ? -previousScaledToDiffScale : previousScaledToDiffScale;
    const quotient = divideHalfUp(magnitude * TEN_THOUSAND, previousMagnitude);
    percent = formatSigned(quotient, 2, negative && quotient !== ZERO);
  }

  return { absolute: formatSigned(magnitude, scale, negative), percent };
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/**
 * The calendar day before `iso` (`YYYY-MM-DD`), pure integer arithmetic — no `Date`, no time
 * zone (US-017 AC3). Handles month, year and leap-year boundaries (`2026-03-01` → `2026-02-28`,
 * `2027-01-01` → `2026-12-31`, `2028-03-01` → `2028-02-29`). Throws `RangeError` on an invalid
 * or non-canonical date string.
 */
export function previousCalendarDay(iso: string): string {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) {
    throw new RangeError(`not a YYYY-MM-DD date string: "${iso}"`);
  }
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`not a valid calendar date: "${iso}"`);
  }

  day -= 1;
  if (day === 0) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    day = daysInMonth(year, month);
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
