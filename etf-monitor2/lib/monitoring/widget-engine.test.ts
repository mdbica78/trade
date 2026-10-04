import { describe, expect, it } from "vitest";
import type { WidgetDefinition } from "../config/widgets";
import { evaluateWidget, type WidgetReport } from "./widget-engine";

const base: WidgetDefinition = {
  operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7,
};
const row = (reportDate: string, value: string | null, status = "ok"): WidgetReport => ({
  reportDate, status, values: { nav_per_unit: value },
});
const reports = [
  row("2026-10-05", "12.50"),
  row("2026-10-03", null),
  row("2026-10-02", "11.00"),
  row("2026-09-28", "10.00"),
  row("2026-09-26", "9.00"),
  row("2026-09-20", "1000", "parse_error"),
];

describe("pure widget engine", () => {
  it("uses the newest ok report, a day-boundary comparison and the actual operand dates", () => {
    expect(evaluateWidget(base, reports)).toEqual({
      status: "ok", value: "2.50", basisDates: ["2026-10-05", "2026-09-28"],
    });
    expect(evaluateWidget({ ...base, periodAmount: 8 }, reports)).toEqual({
      status: "ok", value: "3.50", basisDates: ["2026-10-05", "2026-09-26"],
    });
    expect(evaluateWidget(base, reports.filter((r) => r.status !== "ok"))).toEqual({
      status: "insufficient_history", basisDates: [],
    });
  });

  it("distinguishes inclusive day windows from report-count windows across gaps", () => {
    const average: WidgetDefinition = { ...base, operation: "average", periodAmount: 3 };
    expect(evaluateWidget(average, reports)).toEqual({
      status: "ok", value: "11.7500", basisDates: ["2026-10-05", "2026-10-02"],
    });

    expect(evaluateWidget({ ...average, periodUnit: "reports" }, reports)).toEqual({
      status: "ok", value: "11.7500", basisDates: ["2026-10-05", "2026-10-02"],
    });

    expect(evaluateWidget({ ...base, periodUnit: "reports", periodAmount: 3 }, reports)).toEqual({
      status: "ok", value: "2.50", basisDates: ["2026-10-05", "2026-09-28"],
    });
    expect(evaluateWidget({ ...base, periodUnit: "reports", periodAmount: 5 }, reports)).toEqual({
      status: "insufficient_history", basisDates: [],
    });
  });

  it("anchors day and report windows to the latest stored ok date across leap day and missing dates", () => {
    const spaced = [
      row("2024-03-01", "12"),
      row("2024-02-29", "11"),
      row("2024-02-27", "10"),
      row("2024-02-25", "9"),
    ];
    const average: WidgetDefinition = { ...base, operation: "average", periodAmount: 1 };
    expect(evaluateWidget(average, spaced)).toEqual({
      status: "ok", value: "11.5000", basisDates: ["2024-03-01", "2024-02-29"],
    });
    expect(evaluateWidget({ ...average, periodUnit: "reports" }, spaced)).toEqual({
      status: "ok", value: "12.0000", basisDates: ["2024-03-01"],
    });
    expect(evaluateWidget({ ...base, periodAmount: 2 }, spaced)).toEqual({
      status: "ok", value: "2", basisDates: ["2024-03-01", "2024-02-27"],
    });
  });

  it("skips missing values for current/comparison and returns insufficient instead of zero", () => {
    expect(evaluateWidget(base, [row("2026-10-05", null), row("2026-10-04", "12"), row("2026-09-28", "10")]))
      .toEqual({ status: "ok", value: "2", basisDates: ["2026-10-04", "2026-09-28"] });
    expect(evaluateWidget(base, [row("2026-10-05", "12"), row("2026-10-03", "10")]))
      .toEqual({ status: "insufficient_history", basisDates: [] });
    expect(evaluateWidget({ ...base, operation: "average" }, [row("2026-10-05", null)]))
      .toEqual({ status: "insufficient_history", basisDates: [] });
    expect(evaluateWidget({ ...base, periodUnit: "reports", periodAmount: 1 }, [
      row("2026-10-05", null), row("2026-10-04", "12"), row("2026-10-03", "10"),
    ])).toEqual({ status: "ok", value: "2", basisDates: ["2026-10-04", "2026-10-03"] });
    expect(evaluateWidget({ ...base, periodUnit: "reports", periodAmount: 1 }, [
      row("2026-10-05", null), row("2026-10-04", "12"),
    ])).toEqual({ status: "insufficient_history", basisDates: [] });
  });

  it("computes exact percentage, handles zero divisor and signed rounding", () => {
    const percent: WidgetDefinition = { ...base, operation: "percent_change", periodUnit: "reports", periodAmount: 1 };
    expect(evaluateWidget(percent, [row("2026-10-05", "1.005"), row("2026-10-04", "1")]))
      .toEqual({ status: "ok", value: "0.50", basisDates: ["2026-10-05", "2026-10-04"] });
    expect(evaluateWidget(percent, [row("2026-10-05", "0.995"), row("2026-10-04", "1")]))
      .toEqual({ status: "ok", value: "-0.50", basisDates: ["2026-10-05", "2026-10-04"] });
    expect(evaluateWidget(percent, [row("2026-10-05", "1"), row("2026-10-04", "0")]))
      .toEqual({ status: "ok", value: null, basisDates: ["2026-10-05", "2026-10-04"] });
  });

  it.each([
    ["average", ["-0.0001", "0"], "-0.0001"],
    ["min", ["12.001", "9.99"], "9.99"],
    ["max", ["12.001", "9.99"], "12.001"],
  ] as const)("computes %s exactly and preserves both contributing dates", (operation, values, expected) => {
    expect(evaluateWidget({ ...base, operation, periodUnit: "reports", periodAmount: 2 }, [
      row("2026-10-05", values[0]), row("2026-10-04", values[1]),
    ])).toEqual({
      status: "ok", value: expected, basisDates: ["2026-10-05", "2026-10-04"],
    });
  });
});
