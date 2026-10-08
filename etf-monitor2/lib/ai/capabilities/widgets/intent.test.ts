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

  it.each([0, 7, 1.5])("WI-1: widget_update with slot %s is malformed (US-051 C9 validSlot)", (slot) => {
    expect(validateWidgetAction(
      { capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot, changes: { title: "x" } },
      context,
    )).toEqual({ ok: false, reason: "malformed" });
  });

  it.each([0, 7, "2"])("WI-1: widget_clear with slot %s is malformed (US-051 C9 validSlot)", (slot) => {
    expect(validateWidgetAction(
      { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot },
      context,
    )).toEqual({ ok: false, reason: "malformed" });
  });

  describe("match (WI-M)", () => {
    const multiContext: WidgetContext = {
      etfs: [{
        symbol: "BTBETRETF",
        available: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
        widgets: [
          { id: 1, etfId: 1, slot: 1, operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 30, updatedAt: new Date("2026-10-01") },
          { id: 2, etfId: 1, slot: 2, operation: "min", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7, updatedAt: new Date("2026-10-01") },
          { id: 3, etfId: 1, slot: 3, operation: "max", fieldKey: "nav_per_unit", periodUnit: "reports", periodAmount: 30, updatedAt: new Date("2026-10-01") },
        ],
      }],
    };

    it("WI-M1: widget_clear with a one-key match resolves only widgets equal on that key", () => {
      const result = validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { operation: "max" } },
        multiContext,
      );
      expect(result).toEqual({ ok: true, intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [1, 3] } });
    });

    it("WI-M2: widget_clear with a two-key match narrows further; zero matches is ok, not an error", () => {
      const twoKey = validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { operation: "max", periodAmount: 30 } },
        multiContext,
      );
      expect(twoKey).toEqual({ ok: true, intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [1, 3] } });

      const zero = validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { operation: "average" } },
        multiContext,
      );
      expect(zero).toEqual({ ok: true, intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [] } });
    });

    it("WI-M3: widget_update with a four-key match and widget_clear with all four keys", () => {
      const fourKeyUpdate = validateWidgetAction(
        {
          capability: "widgets", action: "widget_update", etf: "BTBETRETF",
          match: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 30 },
          changes: { title: "Monthly max" },
        },
        multiContext,
      );
      expect(fourKeyUpdate).toEqual({
        ok: true,
        intent: { action: "widget_update", symbol: "BTBETRETF", slots: [1], changes: { title: "Monthly max" } },
      });

      const fourKeyClear = validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "reports", periodAmount: 30 } },
        multiContext,
      );
      expect(fourKeyClear).toEqual({ ok: true, intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [3] } });
    });

    it("WI-M4: both slot and match, or neither, is malformed", () => {
      expect(validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: 1, match: { operation: "max" } },
        multiContext,
      )).toEqual({ ok: false, reason: "malformed" });
      expect(validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF" },
        multiContext,
      )).toEqual({ ok: false, reason: "malformed" });
      expect(validateWidgetAction(
        { capability: "widgets", action: "widget_update", etf: "BTBETRETF", changes: { title: "x" } },
        multiContext,
      )).toEqual({ ok: false, reason: "malformed" });
    });

    it.each([
      [{}, "malformed"],
      [{ operation: "max", extra: 1 }, "malformed"],
      ["not-an-object", "malformed"],
      [{ operation: "maximum" }, "unknown_operation"],
      [{ periodUnit: "weeks" }, "bad_period"],
      [{ periodAmount: 0 }, "bad_period"],
      [{ periodAmount: 366 }, "bad_period"],
      [{ periodAmount: 1.5 }, "bad_period"],
      [{ periodAmount: "7" }, "bad_period"],
      [{ fieldKey: "" }, "malformed"],
      [{ fieldKey: 42 }, "malformed"],
    ] as const)("WI-M5: match %j is rejected as %s", (match, reason) => {
      expect(validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match },
        multiContext,
      )).toEqual({ ok: false, reason });
    });

    it("WI-M6: a fieldKey absent from the catalogue is not an error — it just matches nothing", () => {
      const result = validateWidgetAction(
        { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { fieldKey: "not_in_catalogue" } },
        multiContext,
      );
      expect(result).toEqual({ ok: true, intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [] } });
    });

    it("widget_update by match: a changes value invalid on any matched widget returns that closed reason", () => {
      const result = validateWidgetAction(
        {
          capability: "widgets", action: "widget_update", etf: "BTBETRETF",
          match: { operation: "max" }, changes: { fieldKey: "unlisted" },
        },
        multiContext,
      );
      expect(result).toEqual({ ok: false, reason: "unknown_field" });
    });
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
