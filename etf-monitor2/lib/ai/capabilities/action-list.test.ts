import { describe, expect, it } from "vitest";
import { ALL_ETFS, MAX_ACTIONS_PER_MESSAGE, parseActionListOutput, resolveActionTargets, stripSchemaNulls } from "./action-list";
import { buildTestContext } from "../../../test/helpers/ai-config-context";
import type { ConfigurationContext } from "./configuration/context";

const add = (symbol: string) => ({ capability: "configuration", action: "add_etf", symbol, name: null });

const threeActivePlusInactive: ConfigurationContext = {
  etfs: [
    ...buildTestContext().etfs,
    { symbol: "OLDETF", name: "Old", isActive: false, available: [], tracked: [] },
  ],
};

describe("shared action-list parser", () => {
  it("stripSchemaNulls removes only schema-generated nulls without mutating the action", () => {
    const action = {
      capability: "widgets",
      action: "widget_add",
      etf: "BTBETRETF",
      slot: null,
      match: null,
      definition: { operation: "max", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7, title: null },
      name: null,
      extra: null,
      definitions: [{ operation: "min", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7, title: null }],
    };
    const original = JSON.parse(JSON.stringify(action));
    expect(stripSchemaNulls(action)).toEqual({
      capability: "widgets",
      action: "widget_add",
      etf: "BTBETRETF",
      definition: { operation: "max", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7 },
      name: null,
      definitions: [{ operation: "min", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7 }],
    });
    expect(action).toEqual(original);
  });

  it("normalizes one action into the shared list shape and accepts the five-action limit", () => {
    expect(parseActionListOutput(JSON.stringify({ actions: [add("ONE")] }))).toEqual({
      kind: "actions",
      actions: [add("ONE")],
    });
    const five = Array.from({ length: MAX_ACTIONS_PER_MESSAGE }, (_, index) => add(`ETF${index}`));
    expect(parseActionListOutput(JSON.stringify({ actions: five }))).toEqual({ kind: "actions", actions: five });
  });

  it("rejects a sixth action with the fixed split-request result", () => {
    const six = Array.from({ length: MAX_ACTIONS_PER_MESSAGE + 1 }, (_, index) => add(`ETF${index}`));
    expect(parseActionListOutput(JSON.stringify({ actions: six }))).toEqual({ kind: "too_many" });
  });

  it("accepts only closed top-level envelopes and gives fixed non-action outcomes", () => {
    expect(parseActionListOutput('{"kind":"unsupported"}')).toEqual({ kind: "unsupported" });
    expect(parseActionListOutput('{"kind":"unclear"}')).toEqual({ kind: "unclear", reason: "model_unclear" });
    expect(parseActionListOutput('{"kind":"too_many"}')).toEqual({ kind: "too_many" });
    for (const text of [
      "model text",
      "[]",
      '{"actions":[]}',
      '{"actions":[null]}',
      '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"X","name":null}],"extra":true}',
      '{"action":"multiple"}',
      '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"X","name":null}]} trailing',
    ]) {
      expect(parseActionListOutput(text)).toEqual({ kind: "unclear", reason: "malformed" });
    }
  });
});

describe("resolveActionTargets (RT)", () => {
  it("RT-1: widget_add etf:* expands to one raw action per active ETF, in context order, nothing mutated", () => {
    const raw = { capability: "widgets", action: "widget_add", etf: ALL_ETFS, definition: { operation: "change" } };
    const copy = JSON.parse(JSON.stringify(raw));
    const result = resolveActionTargets(raw, threeActivePlusInactive);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions.map((a) => a.etf)).toEqual(["BTBETRETF", "TVBETETF", "NOADPETF"]);
    for (const action of result.actions) {
      expect(action.definition).toEqual(raw.definition);
    }
    expect(raw).toEqual(copy);
  });

  it("RT-2: track_field symbol:* expands using the symbol key", () => {
    const raw = { capability: "configuration", action: "track_field", symbol: ALL_ETFS, field: "net_asset" };
    const result = resolveActionTargets(raw, threeActivePlusInactive);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions.map((a) => a.symbol)).toEqual(["BTBETRETF", "TVBETETF", "NOADPETF"]);
  });

  it("RT-3: add_etf/remove_etf with * is all_not_allowed", () => {
    expect(resolveActionTargets({ capability: "configuration", action: "add_etf", symbol: ALL_ETFS, name: null }, threeActivePlusInactive))
      .toEqual({ ok: false, reason: "all_not_allowed" });
    expect(resolveActionTargets({ capability: "configuration", action: "remove_etf", symbol: ALL_ETFS }, threeActivePlusInactive))
      .toEqual({ ok: false, reason: "all_not_allowed" });
  });

  it("RT-4: * with no active ETF gives no_active_etfs", () => {
    const allInactive: ConfigurationContext = { etfs: threeActivePlusInactive.etfs.map((e) => ({ ...e, isActive: false })) };
    const result = resolveActionTargets({ capability: "configuration", action: "track_field", symbol: ALL_ETFS, field: "net_asset" }, allInactive);
    expect(result).toEqual({ ok: false, reason: "no_active_etfs" });
  });

  it("RT-5: a non-* action naming an active or unknown symbol is returned unchanged", () => {
    const named = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" };
    expect(resolveActionTargets(named, threeActivePlusInactive)).toEqual({ ok: true, actions: [named] });
    const unknown = { capability: "configuration", action: "track_field", symbol: "NOSUCH", field: "net_asset" };
    expect(resolveActionTargets(unknown, threeActivePlusInactive)).toEqual({ ok: true, actions: [unknown] });
  });

  it("RT-6: an explicitly named inactive ETF is rejected for track/untrack/widget actions but passed through for add/remove", () => {
    for (const raw of [
      { capability: "configuration", action: "track_field", symbol: "OLDETF", field: "net_asset" },
      { capability: "configuration", action: "untrack_field", symbol: "OLDETF", field: "net_asset" },
      { capability: "widgets", action: "widget_add", etf: "OLDETF", definition: {} },
      { capability: "widgets", action: "widget_update", etf: "OLDETF", slot: 1, changes: {} },
      { capability: "widgets", action: "widget_clear", etf: "OLDETF", slot: 1 },
      { capability: "widgets", action: "widget_replace", etf: "OLDETF", definitions: [] },
    ]) {
      expect(resolveActionTargets(raw, threeActivePlusInactive)).toEqual({ ok: false, reason: "etf_inactive", symbol: "OLDETF" });
    }
    for (const raw of [
      { capability: "configuration", action: "add_etf", symbol: "OLDETF", name: null },
      { capability: "configuration", action: "remove_etf", symbol: "OLDETF" },
    ]) {
      expect(resolveActionTargets(raw, threeActivePlusInactive)).toEqual({ ok: true, actions: [raw] });
    }
  });

  it("a numeric slot with * is rejected as bad_slot", () => {
    const raw = { capability: "widgets", action: "widget_clear", etf: ALL_ETFS, slot: 1 };
    expect(resolveActionTargets(raw, threeActivePlusInactive)).toEqual({ ok: false, reason: "bad_slot" });
  });

  it("'slot':'all' with * on widget_clear is allowed (expands normally)", () => {
    const raw = { capability: "widgets", action: "widget_clear", etf: ALL_ETFS, slot: "all" };
    const result = resolveActionTargets(raw, threeActivePlusInactive);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions).toHaveLength(3);
  });
});
