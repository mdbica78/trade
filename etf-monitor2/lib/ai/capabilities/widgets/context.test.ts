import { describe, expect, it } from "vitest";
import { withWidgets, type WidgetContext } from "./context";
import { buildTestContext } from "../../../../test/helpers/ai-config-context";
import type { Widget } from "../../../config/widgets";

function fakeWidget(overrides: Partial<Widget> & Pick<Widget, "slot" | "operation" | "fieldKey" | "periodUnit" | "periodAmount">): Widget {
  return { id: overrides.slot, etfId: 1, updatedAt: new Date("2026-01-01"), ...overrides };
}

describe("withWidgets (WC)", () => {
  it("WC-1: copies each ETF's widgets (slot order) onto the matching context ETF; no id/etfId/updatedAt; [] when absent; no mutation", () => {
    const base = buildTestContext();
    const widgetContext: WidgetContext = {
      etfs: [
        {
          symbol: "BTBETRETF",
          available: [],
          widgets: [
            fakeWidget({ slot: 2, operation: "min", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 }),
            fakeWidget({ slot: 1, operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 }),
          ],
        },
      ],
    };
    const baseSnapshot = JSON.parse(JSON.stringify(base));
    const widgetSnapshot = JSON.parse(JSON.stringify(widgetContext));

    const result = withWidgets(base, widgetContext);

    const bt = result.etfs.find((e) => e.symbol === "BTBETRETF")!;
    expect(bt.widgets).toEqual([
      { slot: 1, operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 },
      { slot: 2, operation: "min", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
    ]);
    for (const widget of bt.widgets ?? []) {
      expect(widget).not.toHaveProperty("id");
      expect(widget).not.toHaveProperty("etfId");
      expect(widget).not.toHaveProperty("updatedAt");
    }
    const other = result.etfs.find((e) => e.symbol === "TVBETETF")!;
    expect(other.widgets).toEqual([]);

    expect(JSON.parse(JSON.stringify(base))).toEqual(baseSnapshot);
    expect(JSON.parse(JSON.stringify(widgetContext))).toEqual(widgetSnapshot);
  });
});
