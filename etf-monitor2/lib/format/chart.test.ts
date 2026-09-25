import { describe, expect, it } from "vitest";
import { formatAxisTick, formatTooltip } from "./chart";

describe("formatTooltip (AC3)", () => {
  it("formats the date and display, never the value (deliberately wrong value proves this)", () => {
    expect(formatTooltip({ date: "2026-09-22", value: 1, display: "54.1373" }, "ro")).toEqual({
      date: "22.09.2026",
      value: "54,1373",
    });
    expect(formatTooltip({ date: "2026-09-22", value: 1, display: "54.1373" }, "en")).toEqual({
      date: "2026-09-22",
      value: "54.1373",
    });
  });

  it("keeps trailing zeros in display exactly as stored", () => {
    expect(formatTooltip({ date: "2026-09-22", value: 11.17, display: "11.1700" }, "ro")?.value).toBe("11,1700");
  });

  it("returns null for a gap point", () => {
    expect(formatTooltip({ date: "2026-09-22", value: null, display: null }, "ro")).toBeNull();
  });
});

describe("formatAxisTick (AC3)", () => {
  it.each([
    ["ro", /^-?\d+(,\d+)?$/],
    ["en", /^-?\d+(\.\d+)?$/],
  ] as const)("every result matches the locale's decimal-mark pattern (%s)", (locale, pattern) => {
    for (const n of [0, -5, 11.2, 0.1 + 0.2, 1234567, 1234567.891, 400000000, 1e15]) {
      expect(formatAxisTick(n, locale)).toMatch(pattern);
    }
  });

  it("never contains a grouping character", () => {
    for (const locale of ["ro", "en"] as const) {
      for (const n of [1234567, 1234567.891, 400000000]) {
        expect(formatAxisTick(n, locale)).not.toMatch(/[  ']/);
      }
    }
  });

  it("exact cases", () => {
    expect(formatAxisTick(400000000, "ro")).toBe("400000000");
    expect(formatAxisTick(400000000, "en")).toBe("400000000");
    expect(formatAxisTick(1234567.891, "ro")).toBe("1234567,891");
    expect(formatAxisTick(1234567.891, "en")).toBe("1234567.891");
    expect(formatAxisTick(0.1 + 0.2, "ro")).toBe("0,3");
    expect(formatAxisTick(0.1 + 0.2, "en")).toBe("0.3");
    expect(formatAxisTick(1e15, "ro")).toBe("1000000000000000");
  });

  it("NaN and Infinity give an empty string", () => {
    expect(formatAxisTick(NaN, "en")).toBe("");
    expect(formatAxisTick(Infinity, "en")).toBe("");
    expect(formatAxisTick(-Infinity, "en")).toBe("");
  });
});
