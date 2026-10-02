import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("US-036 delta boundary", () => {
  it("the production cell delta never requires the calendar day before", () => {
    const source = readFileSync(new URL("./home.ts", import.meta.url), "utf8");
    const start = source.indexOf("function computeCellDelta(");
    const end = source.indexOf("function parseLinks(", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).not.toContain("previousCalendarDay");
  });
});
