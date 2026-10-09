import { describe, expect, it } from "vitest";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import {
  toHomeDisplaySaveInput,
  toggleHomeDisplayColumn,
  toggleHomeDisplayEtf,
  toggleHomeDisplaySwitch,
} from "./home-display-state";

const initial: HomeDisplayPanelModel = {
  saved: false,
  showAbsolute: true,
  showPercent: true,
  showArrow: true,
  etfs: [
    { etfId: 1, symbol: "AAA", name: "Alpha", visible: true },
    { etfId: 2, symbol: "BBB", name: "Beta", visible: true },
  ],
  columns: [
    {
      fieldKey: "tracked_first", labelRo: "A", labelEn: "A", visible: true,
      position: 0, catalogueOrder: 1, showAbsolute: null, showPercent: null, showArrow: null,
    },
    {
      fieldKey: "tracked_second", labelRo: "B", labelEn: "B", visible: true,
      position: 1, catalogueOrder: 2, showAbsolute: null, showPercent: null, showArrow: null,
    },
    {
      fieldKey: "catalogue_first", labelRo: "C", labelEn: "C", visible: false,
      position: null, catalogueOrder: 0, showAbsolute: null, showPercent: null, showArrow: null,
    },
    {
      fieldKey: "catalogue_last", labelRo: "D", labelEn: "D", visible: false,
      position: null, catalogueOrder: 3, showAbsolute: null, showPercent: null, showArrow: null,
    },
  ],
};

describe("home display panel state (US-047 D-4)", () => {
  it("HD-S1: hides and shows an ETF without changing other choices", () => {
    const hidden = toggleHomeDisplayEtf(initial, 1);
    expect(hidden.etfs.map((etf) => etf.visible)).toEqual([false, true]);
    expect(toggleHomeDisplayEtf(hidden, 1).etfs).toEqual(initial.etfs);
  });

  it("HD-S2: a newly checked value column is appended; removal preserves the remaining order", () => {
    const added = toggleHomeDisplayColumn(initial, "catalogue_first");
    expect(added.columns.filter((column) => column.visible).map((column) => column.fieldKey)).toEqual([
      "tracked_first", "tracked_second", "catalogue_first",
    ]);
    expect(added.columns.filter((column) => !column.visible).map((column) => column.fieldKey)).toEqual([
      "catalogue_last",
    ]);

    const removed = toggleHomeDisplayColumn(added, "tracked_first");
    expect(removed.columns.filter((column) => column.visible).map((column) => column.fieldKey)).toEqual([
      "tracked_second", "catalogue_first",
    ]);
    expect(removed.columns.filter((column) => !column.visible).map((column) => column.fieldKey)).toEqual([
      "tracked_first", "catalogue_last",
    ]);
  });

  it.each(["showAbsolute", "showPercent", "showArrow"] as const)(
    "HD-S3: toggles the %s global switch",
    (switchName) => {
      expect(toggleHomeDisplaySwitch(initial, switchName)[switchName]).toBe(false);
    },
  );

  it("HD-S4: serializes only visible columns in their order and preserves per-column overrides", () => {
    const state = toggleHomeDisplayColumn(initial, "catalogue_first");
    const input = toHomeDisplaySaveInput(state);
    expect(input.columns.map((column) => [column.fieldKey, column.position])).toEqual([
      ["tracked_first", 0],
      ["tracked_second", 1],
      ["catalogue_first", 2],
    ]);
    expect(input.columns[0].showAbsolute).toBeNull();
    expect(input.etfs.map((etf) => etf.visible)).toEqual([true, true]);
  });
});
