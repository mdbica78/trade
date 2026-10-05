const CANONICAL_RE = /^-?\d+(\.\d+)?$/;
export const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);

export type ScaledDecimal = { negative: boolean; digits: bigint; scale: number };

export function isCanonicalDecimal(value: string): boolean {
  return CANONICAL_RE.test(value);
}

export function parseCanonical(value: string): ScaledDecimal {
  if (!isCanonicalDecimal(value)) throw new RangeError(`not a canonical decimal string: "${value}"`);
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const dot = unsigned.indexOf(".");
  if (dot === -1) return { negative, digits: BigInt(unsigned), scale: 0 };
  return {
    negative,
    digits: BigInt(unsigned.slice(0, dot) + unsigned.slice(dot + 1)),
    scale: unsigned.length - dot - 1,
  };
}

export function rescale(value: ScaledDecimal, scale: number): bigint {
  const grow = scale - value.scale;
  if (grow < 0) throw new RangeError("rescale cannot discard decimal precision");
  const magnitude = grow > 0 ? value.digits * TEN ** BigInt(grow) : value.digits;
  return value.negative ? -magnitude : magnitude;
}

export function formatSigned(magnitude: bigint, scale: number, negative: boolean): string {
  const digits = magnitude.toString().padStart(scale + 1, "0");
  const wholePart = scale === 0 ? digits : digits.slice(0, -scale);
  const fractionPart = scale === 0 ? "" : `.${digits.slice(-scale)}`;
  return `${negative && magnitude !== ZERO ? "-" : ""}${wholePart}${fractionPart}`;
}

/** `left - right`, rescaled to the larger of the two inputs' scales, exact (US-050 B6). */
export function subtract(a: ScaledDecimal, b: ScaledDecimal): { difference: bigint; scale: number } {
  const scale = Math.max(a.scale, b.scale);
  return { difference: rescale(a, scale) - rescale(b, scale), scale };
}

/** Half away from zero, on non-negative inputs only (US-050 B6). */
export function divideHalfUp(numerator: bigint, divisor: bigint): bigint {
  let quotient = numerator / divisor;
  if ((numerator % divisor) * TWO >= divisor) quotient += BigInt(1);
  return quotient;
}

export function compareCanonical(left: string, right: string): number {
  const { difference } = subtract(parseCanonical(left), parseCanonical(right));
  return difference < ZERO ? -1 : difference > ZERO ? 1 : 0;
}

export function averageCanonical(values: readonly string[], precision = 4): string {
  if (values.length === 0 || !Number.isInteger(precision) || precision < 0) {
    throw new RangeError("average needs values and a non-negative integer precision");
  }
  const parsed = values.map(parseCanonical);
  const scale = Math.max(precision, ...parsed.map((value) => value.scale));
  const sum = parsed.reduce((total, value) => total + rescale(value, scale), ZERO);
  const signed = sum < ZERO ? -sum : sum;
  const divisor = BigInt(values.length) * TEN ** BigInt(scale - precision);
  const rounded = divideHalfUp(signed, divisor);
  return formatSigned(rounded, precision, sum < ZERO);
}
