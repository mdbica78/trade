import { describe, expect, it } from "vitest";
import type { WidgetContext } from "./context";
import { validateWidgetAction } from "./intent";

const definition = { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } as const;
const context: WidgetContext = {
  etfs: [{
    symbol: "BTBETRETF",
    available: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
    widgets: [{
      id: 11,
      etfId: 1,
      slot: 1,
      ...definition,
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    }],
  }],
};

describe("widget action validation", () => {
  it.each([
    ["widget_add", { capability: "widgets", action: "widget_add", etf: "btbetretf", definition }],
    ["widget_update", { capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot: 1, changes: { title: "Weekly move" } }],
    ["widget_clear one", { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: 1 }],
    ["widget_clear all", { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: "all" }],
    ["widget_replace", { capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: [definition] }],
    ["widget_replace empty", { capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: [] }],
  ])("accepts %s", (_name, action) => {
    expect(validateWidgetAction(action, context).ok).toBe(true);
  });

  it.each([
    [{ capability: "widgets", action: "widget_delete", etf: "BTBETRETF" }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, code: "1+1" } }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, operation: "formula" } }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF" }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, operation: null } }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, fieldKey: "unlisted" } }, "unknown_field"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, periodAmount: 0 } }, "bad_period"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, periodUnit: "weeks" } }, "bad_period"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, title: "x".repeat(61) } }, "bad_title"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { ...definition, title: 42 } }, "bad_title"],
    [{ capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot: 2, changes: { title: "x" } }, "bad_slot"],
    [{ capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot: "1", changes: { title: "x" } }, "malformed"],
    [{ capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot: 1, changes: { code: "1+1" } }, "malformed"],
    [{ capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: 2 }, "bad_slot"],
    [{ capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: null }, "malformed"],
    [{ capability: "widgets", action: "widget_add", etf: "MISSING", definition }, "unknown_etf"],
    [{ capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: Array(7).fill(definition) }, "too_many"],
    [{ capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: "not-an-array" }, "malformed"],
    [{ capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: [null] }, "unknown_operation"],
    [{ capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition, ignored: true }, "malformed"],
  ] as const)("returns a closed error for invalid action %#", (action, reason) => {
    expect(validateWidgetAction(action, context)).toEqual({ ok: false, reason });
  });

  it("rejects a valid definition when all widget slots are occupied", () => {
    const fullContext: WidgetContext = {
      etfs: [{
        ...context.etfs[0]!,
        widgets: Array.from({ length: 6 }, (_, index) => ({
          ...context.etfs[0]!.widgets[0]!,
          slot: index + 1,
        })),
      }],
    };
    expect(validateWidgetAction({
      capability: "widgets",
      action: "widget_add",
      etf: "BTBETRETF",
      definition,
    }, fullContext)).toEqual({ ok: false, reason: "too_many" });
  });
});
