import { describe, expect, it } from "vitest";
import type { ExtractionResult } from "../extraction/adapters/types";
import { selectValuesToPersist } from "./select-values";

const baseResult: Extract<ExtractionResult, { ok: true }> = {
  ok: true,
  reportDate: "2026-09-22",
  values: [
    { fieldKey: "units_in_circulation", numericValue: "37520000", rawValue: "37,520,000" },
    { fieldKey: "nav_per_unit", numericValue: "11.171", rawValue: "11.171" },
    { fieldKey: "net_asset", numericValue: "419121833.63", rawValue: "419,121,833.63" },
  ],
  missingFields: [],
};

describe("selectValuesToPersist", () => {
  it("returns only the tracked keys' values, in trackedFieldKeys order", () => {
    const selection = selectValuesToPersist(baseResult, ["nav_per_unit", "units_in_circulation"]);
    expect(selection.complete).toBe(true);
    expect(selection.values.map((v) => v.fieldKey)).toEqual(["nav_per_unit", "units_in_circulation"]);
  });

  it("leaves untracked adapter fields absent", () => {
    const selection = selectValuesToPersist(baseResult, ["nav_per_unit"]);
    expect(selection.values.map((v) => v.fieldKey)).toEqual(["nav_per_unit"]);
  });

  it("a tracked key reported in missingFields makes the selection incomplete", () => {
    const result: Extract<ExtractionResult, { ok: true }> = {
      ...baseResult,
      values: [baseResult.values[0]],
      missingFields: ["nav_per_unit"],
    };
    const selection = selectValuesToPersist(result, ["units_in_circulation", "nav_per_unit"]);
    expect(selection.complete).toBe(false);
    if (!selection.complete) {
      expect(selection.missingFieldKeys).toEqual(["nav_per_unit"]);
      expect(selection.values.map((v) => v.fieldKey)).toEqual(["units_in_circulation"]);
    }
  });

  it("a tracked key unknown to the adapter (neither values nor missingFields) makes it incomplete", () => {
    const selection = selectValuesToPersist(baseResult, ["units_in_circulation", "not_a_real_field"]);
    expect(selection.complete).toBe(false);
    if (!selection.complete) {
      expect(selection.missingFieldKeys).toEqual(["not_a_real_field"]);
    }
  });

  it("zero tracked fields gives complete with zero values", () => {
    const selection = selectValuesToPersist(baseResult, []);
    expect(selection).toEqual({ complete: true, values: [] });
  });

  it("duplicate tracked keys are de-duplicated, keeping one", () => {
    const selection = selectValuesToPersist(baseResult, ["nav_per_unit", "nav_per_unit"]);
    expect(selection.complete).toBe(true);
    expect(selection.values).toHaveLength(1);
  });

  it("does not mutate its inputs", () => {
    const tracked = ["nav_per_unit"];
    const resultCopy = { ...baseResult, values: [...baseResult.values] };
    selectValuesToPersist(resultCopy, tracked);
    expect(tracked).toEqual(["nav_per_unit"]);
    expect(resultCopy.values).toHaveLength(3);
  });
});
