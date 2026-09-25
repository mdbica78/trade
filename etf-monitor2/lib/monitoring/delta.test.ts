import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeDelta, isCanonicalDecimal, previousCalendarDay } from "./delta";

describe("computeDelta absolute (AC1)", () => {
  it("11.091 vs 11.085 -> 0.006", () => {
    expect(computeDelta("11.091", "11.085").absolute).toBe("0.006");
  });
  it("37470000 vs 37500000 -> -30000", () => {
    expect(computeDelta("37470000", "37500000").absolute).toBe("-30000");
  });
  it("8640000.00 vs 8639999.5 -> 0.50 (precision of the more precise input)", () => {
    expect(computeDelta("8640000.00", "8639999.5").absolute).toBe("0.50");
  });
  it("11.091 vs 11.091 -> 0.000, no sign", () => {
    expect(computeDelta("11.091", "11.091").absolute).toBe("0.000");
  });
  it("negative inputs: -10 vs -20 -> 10", () => {
    expect(computeDelta("-10", "-20").absolute).toBe("10");
  });
  it("scale-0 minus scale-4 input: 5 vs 4.9999 -> 0.0001", () => {
    expect(computeDelta("5", "4.9999").absolute).toBe("0.0001");
  });
  it("large values: 415591664.27 vs 415591664.26 -> 0.01", () => {
    expect(computeDelta("415591664.27", "415591664.26").absolute).toBe("0.01");
  });
});

describe("computeDelta percent (AC2)", () => {
  it("11.091 vs 11.085 -> 0.05", () => {
    expect(computeDelta("11.091", "11.085").percent).toBe("0.05");
  });
  it("37470000 vs 37500000 -> -0.08", () => {
    expect(computeDelta("37470000", "37500000").percent).toBe("-0.08");
  });
  it("1000.15 vs 1000 -> 0.02 (exactly 0.015, half away from zero; toFixed on a float gives 0.01)", () => {
    expect(computeDelta("1000.15", "1000").percent).toBe("0.02");
  });
  it("999.85 vs 1000 -> -0.02", () => {
    expect(computeDelta("999.85", "1000").percent).toBe("-0.02");
  });
  it("any value vs 0 -> percent null, absolute still returned", () => {
    expect(computeDelta("5", "0")).toEqual({ absolute: "5", percent: null });
    expect(computeDelta("5", "0.000")).toEqual({ absolute: "5.000", percent: null });
    expect(computeDelta("0", "0")).toEqual({ absolute: "0", percent: null });
  });
  it("rounds to zero without a signed zero: 1000.00004 vs 1000 -> 0.00", () => {
    expect(computeDelta("1000.00004", "1000").percent).toBe("0.00");
  });
  it("rounds to zero the other way: 999.99996 vs 1000 -> 0.00", () => {
    expect(computeDelta("999.99996", "1000").percent).toBe("0.00");
  });
  it("negative denominator: -10 vs -20 -> 50.00", () => {
    expect(computeDelta("-10", "-20").percent).toBe("50.00");
  });
});

describe("isCanonicalDecimal", () => {
  it("accepts canonical strings", () => {
    expect(isCanonicalDecimal("11.091")).toBe(true);
    expect(isCanonicalDecimal("-30000")).toBe(true);
    expect(isCanonicalDecimal("0")).toBe(true);
  });
  it("rejects non-canonical strings", () => {
    expect(isCanonicalDecimal("11,091")).toBe(false);
    expect(isCanonicalDecimal("NaN")).toBe(false);
    expect(isCanonicalDecimal("")).toBe(false);
    expect(isCanonicalDecimal("1.")).toBe(false);
  });
});

describe("previousCalendarDay (AC3)", () => {
  const cases: [string, string][] = [
    ["2026-09-22", "2026-09-21"],
    ["2026-03-01", "2026-02-28"],
    ["2028-03-01", "2028-02-29"], // leap year
    ["2027-01-01", "2026-12-31"], // year boundary
    ["2100-03-01", "2100-02-28"], // century year, not a leap year
  ];

  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      expect(previousCalendarDay(input)).toBe(expected);
    });
  }

  describe("does not depend on the process time zone", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    for (const tz of ["Pacific/Kiritimati", "America/Los_Angeles"]) {
      it(`holds under TZ=${tz}`, () => {
        process.env.TZ = tz;
        for (const [input, expected] of cases) {
          expect(previousCalendarDay(input)).toBe(expected);
        }
      });
    }
  });

  it("throws on invalid input", () => {
    expect(() => previousCalendarDay("2026-02-30")).toThrow(RangeError);
    expect(() => previousCalendarDay("20260922")).toThrow(RangeError);
  });
});

describe("source scan: lib/monitoring/delta.ts never converts with Number/parseFloat/toFixed/Math/Intl/Date (AC1)", () => {
  const fullSource = readFileSync(path.join(__dirname, "delta.ts"), "utf8");
  // Scoped to the exact-arithmetic path (computeDelta and everything it calls). `previousCalendarDay`
  // below that boundary legitimately uses `Number` on regex-captured YYYY/MM/DD components — small
  // calendar integers, never a `numeric_value` on the arithmetic path this scan protects.
  // Strip comments first: the file's own JSDoc prose names every forbidden token on purpose
  // (documenting the rule this scan enforces), which would otherwise self-trigger the scan.
  const withoutComments = fullSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const boundary = withoutComments.indexOf("const ISO_DATE_RE");
  const source = withoutComments.slice(0, boundary);
  const unaryPlusRe = /[=(,:?]\s*\+\s*[A-Za-z_(]/;

  it("found the arithmetic-path boundary (not a vacuous scan)", () => {
    expect(boundary).toBeGreaterThan(0);
    expect(source.length).toBeGreaterThan(500);
  });

  it("positive control: the scan regex finds a unary plus", () => {
    expect(unaryPlusRe.test("const x = +a;")).toBe(true);
  });
  it("negative control: the scan regex ignores binary plus and string literals", () => {
    expect(unaryPlusRe.test("const x = a + b;")).toBe(false);
    expect(unaryPlusRe.test('const s = "+";')).toBe(false);
  });

  it("has no Number(/parseFloat/parseInt/toFixed/Intl/Date call, and no Math beyond Math.max on plain scale integers", () => {
    expect(/\bNumber\s*\(/.test(source)).toBe(false);
    expect(/\bparseFloat\s*\(/.test(source)).toBe(false);
    expect(/\bparseInt\s*\(/.test(source)).toBe(false);
    expect(/\.toFixed\s*\(/.test(source)).toBe(false);
    expect(/\bIntl\b/.test(source)).toBe(false);
    expect(/\bDate\b/.test(source)).toBe(false);
    // Math.max(current.scale, previous.scale) picks between two plain-number decimal-place
    // counts, never a value on the arithmetic path — the only Math usage allowed here.
    const mathCalls = source.match(/\bMath\.\w+/g) ?? [];
    for (const call of mathCalls) {
      expect(call).toBe("Math.max");
    }
  });

  it("has no unary plus on the arithmetic path", () => {
    expect(unaryPlusRe.test(source)).toBe(false);
  });
});
