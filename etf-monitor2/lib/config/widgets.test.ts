import { describe, expect, it } from "vitest";
import {
  MAX_WIDGETS_PER_ETF,
  WIDGET_OPERATIONS,
  WIDGET_PERIOD_UNITS,
  validateWidgetDefinition,
} from "./widgets";

const catalogue = [
  { fieldKey: "nav_per_unit", numeric: true },
  { fieldKey: "descriptive_label", numeric: false },
];
const valid = {
  operation: "change",
  fieldKey: "nav_per_unit",
  periodUnit: "days",
  periodAmount: 7,
};

describe("validateWidgetDefinition (US-043)", () => {
  it.each(WIDGET_OPERATIONS)("accepts closed operation %s", (operation) => {
    expect(validateWidgetDefinition({ ...valid, operation }, catalogue)).toEqual({
      ok: true, value: { ...valid, operation },
    });
  });

  it.each(WIDGET_PERIOD_UNITS)("accepts closed period unit %s at both boundaries", (periodUnit) => {
    for (const periodAmount of [1, 365]) {
      expect(validateWidgetDefinition({ ...valid, periodUnit, periodAmount }, catalogue)).toEqual({
        ok: true, value: { ...valid, periodUnit, periodAmount },
      });
    }
  });

  it("accepts a plain-text title of 60 characters without interpreting it", () => {
    const title = "<script>" + "x".repeat(52);
    expect(validateWidgetDefinition({ ...valid, title }, catalogue)).toEqual({
      ok: true, value: { ...valid, title },
    });
    expect(MAX_WIDGETS_PER_ETF).toBe(6);
  });

  it.each([
    [null, "unknown_operation"],
    [[], "unknown_operation"],
    ["change", "unknown_operation"],
    [{ ...valid, operation: "eval(1)" }, "unknown_operation"],
    [{ ...valid, expression: "1+1" }, "unknown_operation"],
    [{ ...valid, formula: "field + 1" }, "unknown_operation"],
    [{ ...valid, code: "process.exit()" }, "unknown_operation"],
    [{ ...valid, url: "https://example.invalid/" }, "unknown_operation"],
    [{ ...valid, fieldKey: "unknown" }, "unknown_field"],
    [{ ...valid, fieldKey: "descriptive_label" }, "unknown_field"],
    [{ ...valid, fieldKey: "free form label" }, "unknown_field"],
    [{ ...valid, periodUnit: "weeks" }, "bad_period"],
    [{ ...valid, periodAmount: 0 }, "bad_period"],
    [{ ...valid, periodAmount: 366 }, "bad_period"],
    [{ ...valid, periodAmount: 1.5 }, "bad_period"],
    [{ ...valid, periodAmount: "7" }, "bad_period"],
    [{ ...valid, title: "x".repeat(61) }, "bad_title"],
    [{ ...valid, title: 3 }, "bad_title"],
  ])("rejects untrusted input %# with the closed code", (input, error) => {
    expect(validateWidgetDefinition(input, catalogue)).toEqual({ ok: false, error });
  });
});
