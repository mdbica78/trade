import { describe, expect, it } from "vitest";
import { averageCanonical, compareCanonical, isCanonicalDecimal, parseCanonical } from "./exact-decimal";

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
});
