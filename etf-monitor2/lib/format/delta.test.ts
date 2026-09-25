import { describe, expect, it } from "vitest";
import { formatDeltaAbsolute, formatDeltaPercent } from "./delta";

describe("formatDeltaAbsolute", () => {
  it("ro: positive value gets an explicit +, comma decimal mark", () => {
    expect(formatDeltaAbsolute("0.006", "ro")).toBe("+0,006");
  });
  it("en: negative value keeps its -, dot decimal mark", () => {
    expect(formatDeltaAbsolute("-30000", "en")).toBe("-30000");
  });
  it("zero shows no sign", () => {
    expect(formatDeltaAbsolute("0.000", "ro")).toBe("0,000");
  });
  it("a defensive -0.00 input never renders a signed zero", () => {
    expect(formatDeltaAbsolute("-0.00", "ro")).toBe("0,00");
    expect(formatDeltaAbsolute("-0.00", "en")).toBe("0.00");
  });
  it("never contains a grouping character", () => {
    expect(formatDeltaAbsolute("1234567.89", "ro")).not.toMatch(/[  ']/);
    expect(formatDeltaAbsolute("1234567.89", "en")).not.toMatch(/[  ']/);
  });
});

describe("formatDeltaPercent", () => {
  it("ro: positive value gets + and a trailing %", () => {
    expect(formatDeltaPercent("0.05", "ro")).toBe("+0,05%");
  });
  it("en: negative value keeps - and a trailing %", () => {
    expect(formatDeltaPercent("-0.08", "en")).toBe("-0.08%");
  });
  it("zero shows no sign", () => {
    expect(formatDeltaPercent("0.00", "ro")).toBe("0,00%");
  });
  it("a defensive -0.00 input never renders a signed zero percentage", () => {
    expect(formatDeltaPercent("-0.00", "ro")).toBe("0,00%");
  });
  it("% follows the number with no space", () => {
    expect(formatDeltaPercent("0.05", "en")).not.toMatch(/\s%/);
  });
});
