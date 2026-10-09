import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createFakeProvider } from "../../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./registry";
import { resolveActiveProvider, toAvailability, type ActiveProviderResolution } from "./resolve";

function baseSettings(overrides: Partial<{ provider: string | null; model: string | null }> = {}) {
  return { provider: "gemini", model: "m-1", ...overrides };
}

describe("AR: resolveActiveProvider", () => {
  it("AR-1: not_configured for null and blank provider; readApiKey not called", () => {
    const readApiKey = vi.fn();
    const registry = createProviderRegistry([]);
    for (const provider of [null, "  "]) {
      const result = resolveActiveProvider({ settings: baseSettings({ provider }), registry, readApiKey });
      expect(result).toEqual({ ok: false, reason: "not_configured" });
    }
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it("AR-2: unknown_provider for a stored id not in the catalogue; no throw, readApiKey not called", () => {
    const readApiKey = vi.fn();
    const registry = createProviderRegistry([]);
    const result = resolveActiveProvider({ settings: baseSettings({ provider: "foo" }), registry, readApiKey });
    expect(result).toEqual({ ok: false, reason: "unknown_provider" });
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it("AR-3: not_implemented for a catalogued id with no adapter in the registry; readApiKey not called", () => {
    const readApiKey = vi.fn();
    const registry = createProviderRegistry([]);
    const result = resolveActiveProvider({ settings: baseSettings({ provider: "gemini" }), registry, readApiKey });
    expect(result).toEqual({ ok: false, reason: "not_implemented" });
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it("AR-4: no_api_key when readApiKey returns null", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    const result = resolveActiveProvider({ settings: baseSettings(), registry, readApiKey: () => null });
    expect(result).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("AR-5: no_model for null and blank model, key present", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    for (const model of [null, "   "]) {
      const result = resolveActiveProvider({ settings: baseSettings({ model }), registry, readApiKey: () => "k" });
      expect(result).toEqual({ ok: false, reason: "no_model" });
    }
  });

  it("AR-6: ok with the fake provider, trimmed model and the key", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    const result = resolveActiveProvider({ settings: baseSettings({ model: " m-1 " }), registry, readApiKey: () => "k" });
    expect(result).toEqual({ ok: true, provider: gemini, model: "m-1", apiKey: "k" });
  });

  it("AR-7: reports the earliest failing check when several checks would fail", () => {
    const registry = createProviderRegistry([]);
    expect(resolveActiveProvider({ settings: baseSettings({ provider: "foo", model: null }), registry, readApiKey: () => null })).toEqual({
      ok: false,
      reason: "unknown_provider",
    });
    expect(
      resolveActiveProvider({ settings: baseSettings({ provider: "gemini", model: null }), registry, readApiKey: () => null }),
    ).toEqual({ ok: false, reason: "not_implemented" });
  });

  it("AR-7b: implemented, no key and no model reports no_api_key first", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    const result = resolveActiveProvider({ settings: baseSettings({ model: null }), registry, readApiKey: () => null });
    expect(result).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("AR-8: a throwing readApiKey never escapes as an exception", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    const result = resolveActiveProvider({
      settings: baseSettings(),
      registry,
      readApiKey: () => {
        throw new Error("boom");
      },
    });
    expect(result).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("AR-9: toAvailability exposes exactly the expected keys for ok and failure", () => {
    const ok: ActiveProviderResolution = { ok: true, provider: createFakeProvider("gemini"), model: "m-1", apiKey: "k" };
    const okAvailability = toAvailability(ok);
    expect(Object.keys(okAvailability).sort()).toEqual(["available", "model", "providerId"]);

    const failure: ActiveProviderResolution = { ok: false, reason: "no_model" };
    const failureAvailability = toAvailability(failure);
    expect(Object.keys(failureAvailability).sort()).toEqual(["available", "reason"]);
  });

  it("resolution input type has no fetch key (type-level)", () => {
    type Input = Parameters<typeof resolveActiveProvider>[0];
    expectTypeOf<"fetch" extends keyof Input ? true : false>().toEqualTypeOf<false>();
  });
});
