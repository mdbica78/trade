import { describe, expect, it } from "vitest";
import { formatReportDate } from "./date";

describe("formatReportDate", () => {
  it("ro uses day.month.year (BVB's own format)", () => {
    expect(formatReportDate("2026-09-22", "ro")).toBe("22.09.2026");
  });

  it("en keeps the ISO string as-is", () => {
    expect(formatReportDate("2026-09-22", "en")).toBe("2026-09-22");
  });

  it.each([
    ["2026-01-01", "01.01.2026"],
    ["2026-12-31", "31.12.2026"],
    ["2028-02-29", "29.02.2028"], // leap day
  ])("gives the same calendar day at a boundary: %s -> ro %s", (iso, expected) => {
    expect(formatReportDate(iso, "ro")).toBe(expected);
  });

  it("does not depend on the process time zone (pure string parsing, never `new Date`)", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14, a real day-shifting extreme
      expect(formatReportDate("2026-09-22", "ro")).toBe("22.09.2026");
      process.env.TZ = "Etc/GMT+12"; // UTC-12
      expect(formatReportDate("2026-09-22", "ro")).toBe("22.09.2026");
    } finally {
      process.env.TZ = original;
    }
  });
});
