import { describe, expect, it } from "vitest";
import { groundAction, messageTokens } from "./grounding";
import { buildTestContext } from "../../../../test/helpers/ai-config-context";

const context = buildTestContext();

describe("groundAction (CGd)", () => {
  it("CGd-1: add_etf whose symbol is not in the message is symbol_not_in_message", () => {
    const parsed = { kind: "action" as const, action: "add_etf" as const, symbol: "PTENGETF", name: null, field: null };
    expect(groundAction(parsed, "add the energy ETF", context)).toEqual({ kind: "unclear", reason: "symbol_not_in_message" });
  });

  it("CGd-2: track_field for a field the ETF's adapter cannot extract is unknown_field", () => {
    const parsed = { kind: "action" as const, action: "track_field" as const, symbol: "NOADPETF", name: null, field: "net_asset" };
    expect(groundAction(parsed, "track net asset for NOADPETF", context)).toEqual({ kind: "unclear", reason: "unknown_field" });
  });

  it("CGd-3: track_field for a field already tracked is already_tracked with symbol and field", () => {
    const parsed = {
      kind: "action" as const,
      action: "track_field" as const,
      symbol: "BTBETRETF",
      name: null,
      field: "units_in_circulation",
    };
    expect(groundAction(parsed, "track units in circulation for BTBETRETF", context)).toEqual({
      kind: "unclear",
      reason: "already_tracked",
      symbol: "BTBETRETF",
      field: "units_in_circulation",
    });
  });

  it("CGd-4: track/untrack a field that does not exist is unknown_field", () => {
    const track = { kind: "action" as const, action: "track_field" as const, symbol: "BTBETRETF", name: null, field: "no_such_field" };
    expect(groundAction(track, "track no_such_field for BTBETRETF", context)).toEqual({ kind: "unclear", reason: "unknown_field" });
    const untrack = { kind: "action" as const, action: "untrack_field" as const, symbol: "BTBETRETF", name: null, field: "no_such_field" };
    expect(groundAction(untrack, "untrack no_such_field for BTBETRETF", context)).toEqual({ kind: "unclear", reason: "unknown_field" });
  });

  it("CGd-5: untrack_field for an available-but-untracked field is not_tracked with symbol and field", () => {
    const parsed = { kind: "action" as const, action: "untrack_field" as const, symbol: "BTBETRETF", name: null, field: "net_asset" };
    expect(groundAction(parsed, "stop tracking net asset for BTBETRETF", context)).toEqual({
      kind: "unclear",
      reason: "not_tracked",
      symbol: "BTBETRETF",
      field: "net_asset",
    });
  });

  it("CGd-6: a symbol not in the context is unknown_etf (or symbol_not_in_message for add_etf); an un-normalisable symbol behaves the same", () => {
    const remove = { kind: "action" as const, action: "remove_etf" as const, symbol: "ZZZETF", name: null, field: null };
    expect(groundAction(remove, "remove ZZZETF", context)).toEqual({ kind: "unclear", reason: "unknown_etf" });

    for (const badSymbol of ["BT BET", "BTB-ETR"]) {
      const removeInvalid = { kind: "action" as const, action: "remove_etf" as const, symbol: badSymbol, name: null, field: null };
      expect(groundAction(removeInvalid, `remove ${badSymbol}`, context)).toEqual({ kind: "unclear", reason: "unknown_etf" });

      const trackInvalid = { kind: "action" as const, action: "track_field" as const, symbol: badSymbol, name: null, field: "net_asset" };
      expect(groundAction(trackInvalid, `track net asset for ${badSymbol}`, context)).toEqual({ kind: "unclear", reason: "unknown_etf" });

      const addInvalid = { kind: "action" as const, action: "add_etf" as const, symbol: badSymbol, name: null, field: null };
      expect(groundAction(addInvalid, `add ${badSymbol}`, context)).toEqual({ kind: "unclear", reason: "symbol_not_in_message" });
    }
  });

  it("CGd-7: a model-supplied name, invented or verbatim, is never carried into the intent (US-060 AC4)", () => {
    const invented = { kind: "action" as const, action: "add_etf" as const, symbol: "XYZ", name: "XYZ Global Fund", field: null };
    expect(groundAction(invented, "add ETF XYZ", context)).toEqual({ kind: "intent", intent: { action: "add_etf", symbol: "XYZ" } });

    const verbatim = { kind: "action" as const, action: "add_etf" as const, symbol: "XYZ", name: " Fond Test ", field: null };
    expect(groundAction(verbatim, "add ETF XYZ named Fond Test", context)).toEqual({
      kind: "intent",
      intent: { action: "add_etf", symbol: "XYZ" },
    });
  });

  it("CGd-8: symbols and fields are normalised (trim, uppercase symbol; trim, lowercase field)", () => {
    const parsed = { kind: "action" as const, action: "track_field" as const, symbol: "  btbetretf ", name: null, field: " NAV_PER_UNIT " };
    expect(groundAction(parsed, "track NAV_PER_UNIT for btbetretf", context)).toEqual({
      kind: "intent",
      intent: { action: "track_field", symbol: "BTBETRETF", field: "nav_per_unit" },
    });
  });

  it("CGd-9: messageTokens treats letters+digits as one token; a symbol embedded in a longer token does not count", () => {
    expect(messageTokens("add BTBETRETF,").has("BTBETRETF")).toBe(true);
    expect(messageTokens("add btbetretf").has("BTBETRETF")).toBe(true);
    expect(messageTokens("add XBTBETRETF").has("BTBETRETF")).toBe(false);
    expect(messageTokens("add BTBETRETFĂ").has("BTBETRETF")).toBe(false);
    expect(messageTokens("adaugă BTBETRETF-ul").has("BTBETRETF")).toBe(true);

    const parsed = { kind: "action" as const, action: "add_etf" as const, symbol: "BTBETRETF", name: null, field: null };
    expect(groundAction(parsed, "add XBTBETRETF", context)).toEqual({ kind: "unclear", reason: "symbol_not_in_message" });
  });

  it("CGd-10: the returned intent never carries a property the model added", () => {
    const parsed = { kind: "action" as const, action: "add_etf" as const, symbol: "XYZ", name: null, field: null };
    const result = groundAction(parsed, "add ETF XYZ", context);
    expect(result).toEqual({ kind: "intent", intent: { action: "add_etf", symbol: "XYZ" } });
    if (result.kind === "intent") {
      expect(Object.keys(result.intent).sort()).toEqual(["action", "symbol"].sort());
    }
  });
});
