import { describe, expect, it } from "vitest";
import { averageCanonical, compareCanonical, divideHalfUp, isCanonicalDecimal, parseCanonical, subtract } from "./exact-decimal";

describe("shared exact decimal primitives", () => {
  it("rejects noncanonical values and compares arbitrary mixed scales exactly", () => {
    expect(isCanonicalDecimal("1,200")).toBe(false);
    expect(() => parseCanonical("1e3")).toThrow(RangeError);
    expect(compareCanonical("999999999999999999999.999", "1000000000000000000000")).toBe(-1);
    expect(compareCanonical("-0.00001", "0")).toBe(-1);
    expect(compareCanonical("1.000", "1")).toBe(0);
  });

  it.each([
    [["1", "2"], "1.5000"],
    [["0.0001", "0"], "0.0001"],
    [["-0.0001", "0"], "-0.0001"],
    [["0.000005", "0.000005"], "0.0000"],
    [["999999999999999999999.9999", "999999999999999999999.9999"], "999999999999999999999.9999"],
    [["-1.0001", "1"], "-0.0001"],
  ])("rounds the signed exact mean %j half away from zero", (values, result) => {
    expect(averageCanonical(values)).toBe(result);
  });

  it("rejects an empty or malformed average", () => {
    expect(() => averageCanonical([])).toThrow(RangeError);
    expect(() => averageCanonical(["NaN"])).toThrow(RangeError);
  });

  it("ED-4 (US-050 B6): subtract rescales both sides to the common (larger) scale", () => {
    expect(subtract(parseCanonical("1.5"), parseCanonical("0.25"))).toEqual({ difference: BigInt(125), scale: 2 });
    expect(subtract(parseCanonical("-0.001"), parseCanonical("0"))).toEqual({ difference: BigInt(-1), scale: 3 });
  });

  it("ED-5 (US-050 B6): divideHalfUp rounds half away from zero on non-negative inputs", () => {
    expect(divideHalfUp(BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(divideHalfUp(BigInt(4), BigInt(3))).toBe(BigInt(1));
    expect(divideHalfUp(BigInt(0), BigInt(7))).toBe(BigInt(0));
  });
});
