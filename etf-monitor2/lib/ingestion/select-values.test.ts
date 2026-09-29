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
  it("SV-1: every extracted value is returned in adapter order, whatever is tracked", () => {
    const selection = selectValuesToPersist(baseResult, ["nav_per_unit"]);
    expect(selection.complete).toBe(true);
    expect(selection.values.map((v) => v.fieldKey)).toEqual(["units_in_circulation", "nav_per_unit", "net_asset"]);
  });

  it("SV-2: zero tracked keys gives complete with every value", () => {
    const selection = selectValuesToPersist(baseResult, []);
    expect(selection).toEqual({ complete: true, values: baseResult.values });
  });

  it("SV-3: a tracked key reported in missingFields makes the selection incomplete, values still every found value", () => {
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

  it("SV-4: a tracked key unknown to the adapter makes it incomplete, missingFieldKeys in tracked order and de-duplicated", () => {
    const selection = selectValuesToPersist(baseResult, ["not_a_real_field", "not_a_real_field", "units_in_circulation"]);
    expect(selection.complete).toBe(false);
    if (!selection.complete) {
      expect(selection.missingFieldKeys).toEqual(["not_a_real_field"]);
      expect(selection.values.map((v) => v.fieldKey)).toEqual(["units_in_circulation", "nav_per_unit", "net_asset"]);
    }
  });

  it("SV-5: does not mutate its inputs", () => {
    const tracked = ["nav_per_unit"];
    const resultCopy = { ...baseResult, values: [...baseResult.values] };
    selectValuesToPersist(resultCopy, tracked);
    expect(tracked).toEqual(["nav_per_unit"]);
    expect(resultCopy.values).toHaveLength(3);
  });
});
