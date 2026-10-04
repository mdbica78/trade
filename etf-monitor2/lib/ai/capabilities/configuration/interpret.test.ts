import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ACTIONS_PER_MESSAGE } from "../action-list";
import { interpretConfigurationRequest } from "./interpret";
import { PROVIDER_ERROR_CODES } from "../../providers/types";
import { buildTestContext, cannedGenerate, recordingGenerate } from "../../../../test/helpers/ai-config-context";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("real network forbidden"); }));
});

const context = buildTestContext();
const configAction = (action: string, details: Record<string, unknown>) => ({
  capability: "configuration",
  action,
  ...details,
});

describe("interpretConfigurationRequest — shared action-list protocol", () => {
  it.each([
    ["add ETF XYZ", configAction("add_etf", { symbol: "XYZ", name: null })],
    ["stop tracking ETF BTBETRETF", configAction("remove_etf", { symbol: "BTBETRETF" })],
    ["track VUAN for BTBETRETF", configAction("track_field", { symbol: "BTBETRETF", field: "nav_per_unit" })],
    ["untrack units for BTBETRETF", configAction("untrack_field", { symbol: "BTBETRETF", field: "units_in_circulation" })],
  ])("normalizes single %s request to one shared action", async (message, action) => {
    expect(await interpretConfigurationRequest(message, context, cannedGenerate(JSON.stringify({ actions: [action] }))))
      .toEqual({ kind: "actions", actions: [action] });
  });

  it("accepts five ordered mixed-capability actions and refuses six", async () => {
    const actions = [
      configAction("remove_etf", { symbol: "A" }),
      { capability: "widgets", action: "widget_add", etf: "A", definition: {} },
      configAction("track_field", { symbol: "A", field: "x" }),
      { capability: "widgets", action: "widget_clear", etf: "A", slot: "all" },
      configAction("untrack_field", { symbol: "A", field: "x" }),
    ];
    expect(actions).toHaveLength(MAX_ACTIONS_PER_MESSAGE);
    expect(await interpretConfigurationRequest("mix", context, cannedGenerate(JSON.stringify({ actions }))))
      .toEqual({ kind: "actions", actions });
    expect(await interpretConfigurationRequest(
      "six",
      context,
      cannedGenerate(JSON.stringify({ actions: [...actions, actions[0]] })),
    )).toEqual({ kind: "too_many" });
  });

  it("closes malformed envelopes and preserves only fixed unsupported/unclear outcomes", async () => {
    for (const [text, expected] of [
      ["not json", { kind: "unclear", reason: "malformed" }],
      ['{"actions":[]}', { kind: "unclear", reason: "malformed" }],
      ['{"kind":"unsupported"}', { kind: "unsupported" }],
      ['{"kind":"unclear"}', { kind: "unclear", reason: "model_unclear" }],
      ['{"kind":"too_many"}', { kind: "too_many" }],
    ] as const) {
      expect(await interpretConfigurationRequest("request", context, cannedGenerate(text))).toEqual(expected);
    }
  });

  it("provider failures and thrown/malformed generate results never expose their details", async () => {
    for (const code of PROVIDER_ERROR_CODES) {
      expect(await interpretConfigurationRequest("request", context, recordingGenerate({ ok: false, error: code }).generate))
        .toEqual({ kind: "provider_error", error: code });
    }
    const throwing = await interpretConfigurationRequest("request", context, () => {
      throw new Error("SENTINEL-BOOM");
    });
    expect(throwing).toEqual({ kind: "provider_error", error: "provider_error" });
    expect(JSON.stringify(throwing)).not.toContain("SENTINEL-BOOM");
  });

  it("makes exactly one provider generation call", async () => {
    const { generate, calls } = recordingGenerate({ ok: true, text: '{"actions":[{"capability":"configuration","action":"remove_etf","symbol":"A"}]}' });
    await interpretConfigurationRequest("remove ETF A", context, generate);
    expect(calls).toHaveLength(1);
  });
});
