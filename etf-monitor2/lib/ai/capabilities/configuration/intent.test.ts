import { describe, expect, it } from "vitest";
import { parseConfigurationAction } from "./intent";

describe("configuration action parser (CI)", () => {
  it.each([
    [{ capability: "configuration", action: "add_etf", symbol: "XYZ", name: null },
      { kind: "action", action: "add_etf", symbol: "XYZ", name: null, field: null }],
    [{ capability: "configuration", action: "remove_etf", symbol: "XYZ" },
      { kind: "action", action: "remove_etf", symbol: "XYZ", name: null, field: null }],
    [{ capability: "configuration", action: "track_field", symbol: "XYZ", field: "nav_per_unit" },
      { kind: "action", action: "track_field", symbol: "XYZ", name: null, field: "nav_per_unit" }],
    [{ capability: "configuration", action: "untrack_field", symbol: "XYZ", field: "nav_per_unit" },
      { kind: "action", action: "untrack_field", symbol: "XYZ", name: null, field: "nav_per_unit" }],
  ])("CI-1 parses a valid %s configuration action", (raw, expected) => {
    expect(parseConfigurationAction(raw)).toEqual(expected);
  });

  it("CI-2 closes unknown operations, capability ids, and extra properties", () => {
    for (const raw of [
      { capability: "configuration", action: "widget_add", symbol: "XYZ" },
      { capability: "widgets", action: "add_etf", symbol: "XYZ" },
      { capability: "configuration", action: "add_etf", symbol: "XYZ", name: null, formula: "1+1" },
      { capability: "configuration", action: "remove_etf", symbol: "XYZ", note: "ignore" },
    ]) {
      expect(parseConfigurationAction(raw)).toEqual({ kind: "unclear", reason: "malformed" });
    }
  });

  it("CI-3 rejects malformed and wrongly typed required properties", () => {
    for (const raw of [
      {},
      null,
      { capability: "configuration", action: "add_etf", name: null },
      { capability: "configuration", action: "remove_etf" },
      { capability: "configuration", action: "track_field", symbol: "A" },
      { capability: "configuration", action: "untrack_field", symbol: "A", field: null },
      { capability: "configuration", action: "add_etf", symbol: 42, name: null },
      { capability: "configuration", action: "add_etf", symbol: "A", name: 7 },
    ]) {
      expect(parseConfigurationAction(raw)).toEqual({ kind: "unclear", reason: "malformed" });
    }
  });

  it("CI-4 parses a tagged single action object and never propagates model properties", () => {
    expect(parseConfigurationAction({ capability: "configuration", action: "add_etf", symbol: "XYZ" })).toEqual({
      kind: "action",
      action: "add_etf",
      symbol: "XYZ",
      name: null,
      field: null,
    });
    expect(parseConfigurationAction({ capability: "configuration", action: "add_etf", symbol: "X", extra: "sentinel" }))
      .toEqual({ kind: "unclear", reason: "malformed" });
  });
});
