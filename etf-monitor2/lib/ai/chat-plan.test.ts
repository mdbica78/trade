import { describe, expect, it } from "vitest";
import type { ConfigurationContext } from "./capabilities/configuration/context";
import type { WidgetContext } from "./capabilities/widgets/context";
import type { PlannedAction } from "./chat-plan";
import {
  canonicalJson,
  needsConfirmation,
  planFingerprint,
  signPlanToken,
  verifyPlanToken,
} from "./chat-plan";

const removeEtf: PlannedAction = {
  index: 1,
  capability: "configuration",
  intent: { action: "remove_etf", symbol: "PTENGETF" },
};
const clearA: PlannedAction = {
  index: 1,
  capability: "widgets",
  intent: { action: "widget_clear", symbol: "BTBETRETF", slots: [1] },
};
const clearB: PlannedAction = {
  index: 2,
  capability: "widgets",
  intent: { action: "widget_clear", symbol: "PTENGETF", slots: [] },
};
const replaceB: PlannedAction = {
  index: 2,
  capability: "widgets",
  intent: {
    action: "widget_replace",
    symbol: "PTENGETF",
    definitions: [{ operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 }],
  },
};
const addEtf: PlannedAction = {
  index: 1,
  capability: "configuration",
  intent: { action: "add_etf", symbol: "NEWETF", name: null },
};
const configuration: ConfigurationContext = {
  etfs: [
    { symbol: "BTBETRETF", name: "BRD ETF", isActive: true, available: [], tracked: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV" }] },
    { symbol: "PTENGETF", name: "ETF", isActive: true, available: [], tracked: [] },
  ],
};
const widgets: WidgetContext = {
  etfs: [
    {
      symbol: "BTBETRETF",
      available: [],
      widgets: [{ id: 1, etfId: 1, slot: 1, operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7, updatedAt: new Date(0) }],
    },
    { symbol: "PTENGETF", available: [], widgets: [] },
  ],
};
const signingKey = new Uint8Array(32).fill(11);

describe("chat confirmation plan (US-058)", () => {
  it("requires confirmation for destructive config actions and multi-ETF clear/replace, not one-ETF edits", () => {
    expect(needsConfirmation([removeEtf])).toBe(true);
    expect(needsConfirmation([{ index: 1, capability: "configuration", intent: { action: "untrack_field", symbol: "PTENGETF", field: "nav_per_unit" } }])).toBe(true);
    expect(needsConfirmation([clearA])).toBe(false);
    expect(needsConfirmation([clearA, clearB])).toBe(true);
    expect(needsConfirmation([clearA, replaceB])).toBe(true);
    expect(needsConfirmation([addEtf, removeEtf])).toBe(true);
    expect(needsConfirmation([{ index: 1, capability: "widgets", intent: { action: "widget_add", symbol: "BTBETRETF", definition: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } } }])).toBe(false);
  });

  it("canonicalizes object keys and fingerprints the active, tracked and widget state", () => {
    expect(canonicalJson({ b: 2, a: { y: 1, x: 0 } })).toBe(canonicalJson({ a: { x: 0, y: 1 }, b: 2 }));
    const before = planFingerprint([clearA], configuration, widgets);
    expect(planFingerprint([clearA], configuration, widgets)).toBe(before);
    expect(planFingerprint([clearA], configuration, {
      etfs: [{ ...widgets.etfs[0]!, widgets: [{ ...widgets.etfs[0]!.widgets[0]!, periodAmount: 30 }] }, widgets.etfs[1]!],
    })).not.toBe(before);
    expect(planFingerprint([clearA], { etfs: configuration.etfs.map((etf) => etf.symbol === "PTENGETF" ? { ...etf, isActive: false } : etf) }, widgets))
      .not.toBe(before);
    expect(planFingerprint([removeEtf], { etfs: configuration.etfs.map((etf) => etf.symbol === "PTENGETF" ? { ...etf, tracked: [{ fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" }] } : etf) }, widgets))
      .not.toBe(planFingerprint([removeEtf], configuration, widgets));
  });

  it("signs the exact plan, rejects tampering, and distinguishes expiry", () => {
    const fp = planFingerprint([removeEtf], configuration, widgets);
    const token = signPlanToken({ plan: [removeEtf], fp, exp: 10_000, n: "test-nonce" }, signingKey);
    expect(verifyPlanToken(token, signingKey, 9_999)).toEqual({ ok: true, plan: [removeEtf], fp });
    expect(verifyPlanToken(`${token}x`, signingKey, 0)).toEqual({ ok: false, reason: "tampered" });
    expect(verifyPlanToken(token, signingKey, 10_000)).toEqual({ ok: false, reason: "expired" });
    expect(verifyPlanToken(token, new Uint8Array(32).fill(12), 0)).toEqual({ ok: false, reason: "tampered" });
  });
});
