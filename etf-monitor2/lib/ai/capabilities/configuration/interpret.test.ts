import { beforeEach, describe, expect, it, vi } from "vitest";
import { interpretConfigurationRequest } from "./interpret";
import { PROVIDER_ERROR_CODES } from "../../providers/types";
import { buildTestContext, cannedGenerate, recordingGenerate } from "../../../../test/helpers/ai-config-context";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

const context = buildTestContext();

describe("interpretConfigurationRequest — AC4 the four actions are recognised (CX-4)", () => {
  const cases: [string, string, string, unknown][] = [
    ["CX-4a", "add ETF XYZ", '{"action":"add_etf","symbol":"XYZ","name":null}', { kind: "intent", intent: { action: "add_etf", symbol: "XYZ", name: null } }],
    ["CX-4b", "adaugă ETF-ul XYZ", '{"action":"add_etf","symbol":"xyz","name":null}', { kind: "intent", intent: { action: "add_etf", symbol: "XYZ", name: null } }],
    ["CX-4c", "stop tracking ETF BTBETRETF", '{"action":"remove_etf","symbol":"BTBETRETF"}', { kind: "intent", intent: { action: "remove_etf", symbol: "BTBETRETF" } }],
    ["CX-4d", "nu mai urmări BTBETRETF", '{"action":"remove_etf","symbol":" btbetretf "}', { kind: "intent", intent: { action: "remove_etf", symbol: "BTBETRETF" } }],
    ["CX-4g", "stop tracking units in circulation for BTBETRETF", '{"action":"untrack_field","symbol":"BTBETRETF","field":"units_in_circulation"}', { kind: "intent", intent: { action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" } }],
    ["CX-4h", "nu mai urmări unitățile în circulație pentru BTBETRETF", '{"action":"untrack_field","symbol":"BTBETRETF","field":"units_in_circulation"}', { kind: "intent", intent: { action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" } }],
    ["CX-4i", "add ETF XYZ named Fond Test XYZ", '{"action":"add_etf","symbol":"XYZ","name":"Fond Test XYZ"}', { kind: "intent", intent: { action: "add_etf", symbol: "XYZ", name: "Fond Test XYZ" } }],
  ];

  for (const [id, message, modelText, expected] of cases) {
    it(`${id}: ${message}`, async () => {
      const result = await interpretConfigurationRequest(message, context, cannedGenerate(modelText));
      expect(result).toEqual(expected);
    });
  }

  it("CX-4e: track VUAN for BTBETRETF (test context does not track nav_per_unit yet) → intent", async () => {
    const result = await interpretConfigurationRequest(
      "also track VUAN for BTBETRETF",
      context,
      cannedGenerate('{"action":"track_field","symbol":"BTBETRETF","field":"nav_per_unit"}'),
    );
    expect(result).toEqual({ kind: "intent", intent: { action: "track_field", symbol: "BTBETRETF", field: "nav_per_unit" } });
  });

  it("CX-4f: track activul net for BTBETRETF → net_asset intent", async () => {
    const result = await interpretConfigurationRequest(
      "urmărește și activul net pentru BTBETRETF",
      context,
      cannedGenerate('{"action":"track_field","symbol":"BTBETRETF","field":"net_asset"}'),
    );
    expect(result).toEqual({ kind: "intent", intent: { action: "track_field", symbol: "BTBETRETF", field: "net_asset" } });
  });
});

describe("interpretConfigurationRequest — AC5 non-actions never execute (CX-5)", () => {
  it("CX-5: malformed model text is unclear/malformed", async () => {
    const result = await interpretConfigurationRequest("add ETF XYZ", context, cannedGenerate("I cannot help"));
    expect(result).toEqual({ kind: "unclear", reason: "malformed" });
  });
});

describe("interpretConfigurationRequest — AC6 grounding (CX-6)", () => {
  it("CX-6: add the energy ETF with a wrong-symbol answer is symbol_not_in_message", async () => {
    const result = await interpretConfigurationRequest(
      "add the energy ETF",
      context,
      cannedGenerate('{"action":"add_etf","symbol":"PTENGETF","name":null}'),
    );
    expect(result).toEqual({ kind: "unclear", reason: "symbol_not_in_message" });
  });
});

describe("interpretConfigurationRequest — AC7 scope is configuration only (CX-7)", () => {
  it("CX-7: out-of-scope questions and actions are unsupported; a model-side unclear is model_unclear", async () => {
    for (const message of ["what is the VUAN of BTBETRETF today?", "write me a poem"]) {
      const result = await interpretConfigurationRequest(message, context, cannedGenerate('{"action":"unsupported"}'));
      expect(result).toEqual({ kind: "unsupported" });
    }
    for (const text of [
      '{"action":"set_cron_hour","hour":9}',
      '{"action":"set_ai_provider","provider":"groq"}',
      '{"action":"move_field","symbol":"BTBETRETF","field":"nav_per_unit","direction":"up"}',
    ]) {
      const result = await interpretConfigurationRequest("do something else", context, cannedGenerate(text));
      expect(result).toEqual({ kind: "unsupported" });
    }
    const unclear = await interpretConfigurationRequest("add the energy ETF", context, cannedGenerate('{"action":"unclear"}'));
    expect(unclear).toEqual({ kind: "unclear", reason: "model_unclear" });
  });
});

describe("interpretConfigurationRequest — AC8 provider failures and no side effects (CX-8)", () => {
  it("CX-8a: every ProviderErrorCode passes through as provider_error with that code", async () => {
    expect(PROVIDER_ERROR_CODES).toHaveLength(7);
    for (const code of PROVIDER_ERROR_CODES) {
      const { generate } = recordingGenerate({ ok: false, error: code });
      const result = await interpretConfigurationRequest("add ETF XYZ", context, generate);
      expect(result).toEqual({ kind: "provider_error", error: code });
    }
  });

  it("CX-8b: a throwing, rejecting or malformed generate all become provider_error, with no leaked message", async () => {
    const throwsSync = await interpretConfigurationRequest("add ETF XYZ", context, () => {
      throw new Error("SENTINEL-BOOM");
    });
    expect(throwsSync).toEqual({ kind: "provider_error", error: "provider_error" });
    expect(JSON.stringify(throwsSync)).not.toContain("SENTINEL-BOOM");

    const rejects = await interpretConfigurationRequest("add ETF XYZ", context, () => Promise.reject(new Error("SENTINEL-REJECT")));
    expect(rejects).toEqual({ kind: "provider_error", error: "provider_error" });

    const undefinedResult = await interpretConfigurationRequest("add ETF XYZ", context, () => Promise.resolve(undefined as never));
    expect(undefinedResult).toEqual({ kind: "provider_error", error: "provider_error" });
  });

  it("CX-8c: exactly one generate call per outcome kind", async () => {
    const scenarios: [string, string][] = [
      ["intent", '{"action":"add_etf","symbol":"XYZ","name":null}'],
      ["unsupported", '{"action":"unsupported"}'],
      ["unclear", '{"action":"unclear"}'],
      ["multiple", '{"action":"multiple"}'],
    ];
    for (const [, text] of scenarios) {
      const { generate, calls } = recordingGenerate({ ok: true, text });
      await interpretConfigurationRequest("add ETF XYZ", context, generate);
      expect(calls).toHaveLength(1);
    }
    const { generate: errGenerate, calls: errCalls } = recordingGenerate({ ok: false, error: "provider_error" });
    await interpretConfigurationRequest("add ETF XYZ", context, errGenerate);
    expect(errCalls).toHaveLength(1);
  });
});
