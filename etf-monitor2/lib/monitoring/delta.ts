/**
 * Exact day-over-day delta arithmetic on canonical decimal strings (US-017). No `Number`,
 * `parseFloat`, `toFixed`, `Math`, `Intl` or `Date` on the arithmetic path — `report_values
 * .numeric_value` reaches the app as an exact string, and floats would silently corrupt it
 * (`11.091 - 11.085` is `0.005999999999999339` in IEEE-754). All arithmetic below is on
 * `bigint` digit strings.
 */

export type Delta = { absolute: string; percent: string | null };

const CANONICAL_RE = /^-?\d+(\.\d+)?$/;

/** True for a canonical decimal string as `report_values.numeric_value` stores it (US-010). */
export function isCanonicalDecimal(s: string): boolean {
  return CANONICAL_RE.test(s);
}

// `10n`-style BigInt literals need `target >= ES2020` (this repo's tsconfig targets ES2017,
// DEC-008), so every BigInt constant below goes through `BigInt(...)` instead.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);
const TEN_THOUSAND = BigInt(10000);

type Scaled = { negative: boolean; digits: bigint; scale: number };

function parseCanonical(s: string): Scaled {
  if (!CANONICAL_RE.test(s)) {
    throw new RangeError(`not a canonical decimal string: "${s}"`);
  }
  const negative = s.startsWith("-");
  const unsigned = negative ? s.slice(1) : s;
  const dot = unsigned.indexOf(".");
  if (dot === -1) {
    return { negative, digits: BigInt(unsigned), scale: 0 };
  }
  const wholePart = unsigned.slice(0, dot);
  const fractionPart = unsigned.slice(dot + 1);
  return { negative, digits: BigInt(wholePart + fractionPart), scale: fractionPart.length };
}

function rescale(value: Scaled, scale: number): bigint {
  const grow = scale - value.scale;
  const magnitude = grow > 0 ? value.digits * TEN ** BigInt(grow) : value.digits;
  return value.negative ? -magnitude : magnitude;
}

function formatSigned(magnitude: bigint, scale: number, negative: boolean): string {
  const digits = magnitude.toString().padStart(scale + 1, "0");
  const wholePart = scale === 0 ? digits : digits.slice(0, -scale);
  const fractionPart = scale === 0 ? "" : `.${digits.slice(-scale)}`;
  const sign = negative && magnitude !== ZERO ? "-" : "";
  return `${sign}${wholePart}${fractionPart}`;
}

type AbsoluteDelta = { magnitude: bigint; scale: number; negative: boolean };

/**
 * `current - previous`, exact, at the scale of the more precise input (US-017 AC1). Zero always
 * prints without a sign, so `-0` can never appear.
 */
function computeAbsolute(current: Scaled, previous: Scaled): AbsoluteDelta {
  const scale = Math.max(current.scale, previous.scale);
  const diff = rescale(current, scale) - rescale(previous, scale);
  return { magnitude: diff < ZERO ? -diff : diff, scale, negative: diff < ZERO };
}

/**
 * `(current - previous) / |previous| * 100`, rounded to 2 decimals, half away from zero on the
 * magnitude (US-017 AC2/decision 2). `null` when `previous` is zero. The sign follows the
 * *rounded* value, so a change that rounds to zero is always `"0.00"`, never `"-0.00"`.
 */
function computePercent(current: Scaled, previous: Scaled): string | null {
  if (previous.digits === ZERO) {
    return null;
  }
  // Both must be at the same scale before their ratio means anything: diffMagnitude and
  // previousMagnitude below are each "value * 10^scale", so the 10^scale factors cancel in the
  // division. Using previous.digits (native scale) directly here was a bug caught while writing
  // this: it silently misplaced the decimal point whenever previous.scale !== scale.
  const scale = Math.max(current.scale, previous.scale);
  const diff = rescale(current, scale) - rescale(previous, scale);
  const diffMagnitude = diff < ZERO ? -diff : diff;
  const previousScaled = rescale(previous, scale);
  const previousMagnitude = previousScaled < ZERO ? -previousScaled : previousScaled;

  // percent-times-100 = diffMagnitude * 10000 / previousMagnitude, rounded half away from zero.
  const numerator = diffMagnitude * TEN_THOUSAND;
  let quotient = numerator / previousMagnitude;
  const remainder = numerator % previousMagnitude;
  if (remainder * TWO >= previousMagnitude) {
    quotient += BigInt(1);
  }

  const isZero = quotient === ZERO;
  const negative = diff < ZERO && !isZero;
  return formatSigned(quotient, 2, negative);
}

/**
 * `current` and `previous` are canonical decimal strings (`report_values.numeric_value`, US-010).
 * Throws `RangeError` on a non-canonical input — the caller (`buildViewModel`) checks
 * `isCanonicalDecimal` first and returns `delta: null` instead of calling this on bad input.
 */
export function computeDelta(current: string, previous: string): Delta {
  const currentScaled = parseCanonical(current);
  const previousScaled = parseCanonical(previous);
  const { magnitude, scale, negative } = computeAbsolute(currentScaled, previousScaled);
  return {
    absolute: formatSigned(magnitude, scale, negative),
    percent: computePercent(currentScaled, previousScaled),
  };
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
