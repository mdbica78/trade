import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("formats to two decimal places", () => {
    expect(formatNumber(415591664.2)).toBe("415591664.20");
  });
});
