import { describe, expect, it } from "vitest";
import { describeWidgetAction, groupResults } from "./chat-results";
import type { WidgetIntent } from "./capabilities/widgets/intent";
import type { ChatActionResult } from "./chat";

const field = { fieldKey: "units_in_circulation", labelRo: "Unități în circulație", labelEn: "Units in circulation" };

describe("describeWidgetAction (GR)", () => {
  it("GR-1: widget_add -> operation/fieldKey/period from the definition, field attached", () => {
    const intent: WidgetIntent = {
      action: "widget_add",
      symbol: "BTBETRETF",
      definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
    };
    expect(describeWidgetAction(intent, field)).toEqual({
      operation: "max",
      fieldKey: "units_in_circulation",
      field,
      periodUnit: "days",
      periodAmount: 7,
    });
  });

  it("GR-2: widget_update by match -> slot omitted (single), to carries the parsed changes", () => {
    const intent: WidgetIntent = {
      action: "widget_update",
      symbol: "BTBETRETF",
      slot: 2,
      changes: { periodAmount: 90 },
    };
    expect(describeWidgetAction(intent)).toEqual({
      slot: 2,
      to: { operation: undefined, fieldKey: undefined, field: undefined, periodUnit: undefined, periodAmount: 90 },
    });
  });

  it("GR-3: widget_update over expanded slots -> slot 'all' when more than one slot matched, the single slot otherwise", () => {
    const multi: WidgetIntent = { action: "widget_update", symbol: "BTBETRETF", slots: [1, 3], changes: { periodAmount: 90 } };
    expect(describeWidgetAction(multi).slot).toBe("all");
    const single: WidgetIntent = { action: "widget_update", symbol: "BTBETRETF", slots: [2], changes: { periodAmount: 90 } };
    expect(describeWidgetAction(single).slot).toBe(2);
  });

  it("GR-4: widget_clear by slot and by expanded slots", () => {
    const bySlot: WidgetIntent = { action: "widget_clear", symbol: "BTBETRETF", slot: "all" };
    expect(describeWidgetAction(bySlot)).toEqual({ slot: "all" });
    const byOne: WidgetIntent = { action: "widget_clear", symbol: "BTBETRETF", slot: 3 };
    expect(describeWidgetAction(byOne)).toEqual({ slot: 3 });
    const expanded: WidgetIntent = { action: "widget_clear", symbol: "BTBETRETF", slots: [1, 2] };
    expect(describeWidgetAction(expanded)).toEqual({ slot: "all" });
  });

  it("GR-5: widget_replace -> count of definitions", () => {
    const intent: WidgetIntent = {
      action: "widget_replace",
      symbol: "BTBETRETF",
      definitions: [
        { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
        { operation: "min", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
      ],
    };
    expect(describeWidgetAction(intent)).toEqual({ count: 2 });
  });
});

function widgetResult(overrides: Partial<ChatActionResult> & { symbol: string }): ChatActionResult {
  return { index: 1, status: "done", capability: "widgets", action: "widget_clear", changed: true, ...overrides };
}

describe("groupResults (GR)", () => {
  it("groups identically-shaped results across symbols, keeping first-appearance order", () => {
    const results: ChatActionResult[] = [
      widgetResult({ symbol: "BTBETRETF" }),
      widgetResult({ symbol: "TVBETETF" }),
    ];
    const groups = groupResults(results);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.symbols).toEqual(["BTBETRETF", "TVBETETF"]);
  });

  it("ignores symbol and slot when grouping (same action/status/shape, different slot)", () => {
    const results: ChatActionResult[] = [
      widgetResult({ symbol: "BTBETRETF", widget: { action: "widget_clear", symbol: "BTBETRETF", changed: true, slot: 1, matched: 1 } }),
      widgetResult({ symbol: "TVBETETF", widget: { action: "widget_clear", symbol: "TVBETETF", changed: true, slot: 3, matched: 1 } }),
    ];
    const groups = groupResults(results);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.symbols).toEqual(["BTBETRETF", "TVBETETF"]);
  });

  it("keeps a nothing-matched result in a separate group from a changed one", () => {
    const results: ChatActionResult[] = [
      widgetResult({ symbol: "BTBETRETF", changed: true, widget: { action: "widget_clear", symbol: "BTBETRETF", changed: true, slot: 1, matched: 1 } }),
      widgetResult({ symbol: "PTENGETF", changed: false, widget: { action: "widget_clear", symbol: "PTENGETF", changed: false, slot: null, matched: 0 } }),
    ];
    const groups = groupResults(results);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.symbols).toEqual(["BTBETRETF"]);
    expect(groups[1]!.symbols).toEqual(["PTENGETF"]);
  });

  it("preserves overall order: a later-appearing new shape starts its own group after an earlier repeat", () => {
    const results: ChatActionResult[] = [
      widgetResult({ symbol: "A", status: "done" }),
      widgetResult({ symbol: "B", status: "failed" }),
      widgetResult({ symbol: "C", status: "done" }),
    ];
    const groups = groupResults(results);
    expect(groups.map((g) => g.symbols)).toEqual([["A", "C"], ["B"]]);
  });
});
