import { afterEach, describe, expect, it } from "vitest";
import { buildChartSeries, hasAnyValue } from "./chart-series";
import type { HistoryRow } from "./history";

function row(reportDate: string, values: Record<string, string | null>): HistoryRow {
  return { reportDate, values };
}

describe("buildChartSeries (AC2)", () => {
  it("ascending order, one point per calendar day, from newest-first input", () => {
    const rows = [row("2026-09-23", { nav: "12" }), row("2026-09-21", { nav: "10" })];
    const points = buildChartSeries(rows, "nav");
    expect(points.map((p) => p.date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(points[1]).toEqual({ date: "2026-09-22", value: null, display: null });
  });

  it("gives the same result regardless of input order (shuffled)", () => {
    const rows = [row("2026-09-21", { nav: "10" }), row("2026-09-23", { nav: "12" })];
    const shuffled = [rows[1], rows[0]];
    expect(buildChartSeries(shuffled, "nav")).toEqual(buildChartSeries(rows, "nav"));
  });

  it("no carry-forward: a later day missing the field is null, not the earlier day's value", () => {
    const rows = [row("2026-09-21", { nav: "10" }), row("2026-09-23", {})];
    const points = buildChartSeries(rows, "nav");
    const day23 = points.find((p) => p.date === "2026-09-23")!;
    expect(day23).toEqual({ date: "2026-09-23", value: null, display: null });
  });

  it("every point's display is null or a string present in the input for that date; value is Number(display) or null", () => {
    const rows = [row("2026-09-21", { nav: "10.5" }), row("2026-09-22", { nav: null }), row("2026-09-23", { nav: "11" })];
    const points = buildChartSeries(rows, "nav");
    for (const p of points) {
      if (p.display === null) {
        expect(p.value).toBeNull();
      } else {
        expect(p.value).toBe(Number(p.display));
        const inputRow = rows.find((r) => r.reportDate === p.date);
        expect(inputRow?.values.nav).toBe(p.display);
      }
    }
  });

  it("one row gives one point; no rows gives an empty array", () => {
    expect(buildChartSeries([row("2026-09-22", { nav: "5" })], "nav")).toEqual([
      { date: "2026-09-22", value: 5, display: "5" },
    ]);
    expect(buildChartSeries([], "nav")).toEqual([]);
  });

  it("handles DST boundaries (2026-03-28..30, 2026-10-24..26) with exactly one point per day", () => {
    const spring = [row("2026-03-28", { nav: "1" }), row("2026-03-30", { nav: "3" })];
    expect(buildChartSeries(spring, "nav").map((p) => p.date)).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);

    const autumn = [row("2026-10-24", { nav: "1" }), row("2026-10-26", { nav: "3" })];
    expect(buildChartSeries(autumn, "nav").map((p) => p.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("handles a year boundary (2026-12-30..2027-01-02) with exactly one point per day", () => {
    const rows = [row("2026-12-30", { nav: "1" }), row("2027-01-02", { nav: "4" })];
    expect(buildChartSeries(rows, "nav").map((p) => p.date)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  describe("does not depend on the process time zone", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    for (const tz of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
      it(`holds under TZ=${tz}`, () => {
        process.env.TZ = tz;
        const rows = [row("2026-09-21", { nav: "10" }), row("2026-09-23", { nav: "12" })];
        expect(buildChartSeries(rows, "nav").map((p) => p.date)).toEqual([
          "2026-09-21",
          "2026-09-22",
          "2026-09-23",
        ]);
      });
    }
  });

  it("throws on a malformed date, and does not loop forever", () => {
    expect(() => buildChartSeries([row("2026-13-45", { nav: "1" })], "nav")).toThrow(RangeError);
  });
});

describe("hasAnyValue (AC4)", () => {
  it("false for an empty array", () => {
    expect(hasAnyValue([])).toBe(false);
  });
  it("false when every point is a gap", () => {
    expect(hasAnyValue([{ date: "2026-09-21", value: null, display: null }])).toBe(false);
  });
  it("true when at least one point has a value", () => {
    expect(
      hasAnyValue([
        { date: "2026-09-21", value: null, display: null },
        { date: "2026-09-22", value: 5, display: "5" },
      ]),
    ).toBe(true);
  });
});
