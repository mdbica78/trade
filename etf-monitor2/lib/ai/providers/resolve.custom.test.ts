import { describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./registry";
import { resolveActiveProvider } from "./resolve";

function baseSettings(overrides: Partial<{ provider: string | null; model: string | null }> = {}) {
  return { provider: "custom-1", model: "m-1", ...overrides };
}

describe("resolveActiveProvider with a custom provider (RSC)", () => {
  it("RSC-1: a matching customProvider resolves ok with that adapter", () => {
    const custom = createFakeProvider("custom-1");
    const registry = createProviderRegistry([]);
    const result = resolveActiveProvider({
      settings: baseSettings(),
      registry,
      readApiKey: () => "k",
      customProvider: custom,
    });
    expect(result).toEqual({ ok: true, provider: custom, model: "m-1", apiKey: "k" });
  });

  it("RSC-2: no key gives no_api_key", () => {
    const custom = createFakeProvider("custom-1");
    const registry = createProviderRegistry([]);
    const result = resolveActiveProvider({
      settings: baseSettings(),
      registry,
      readApiKey: () => null,
      customProvider: custom,
    });
    expect(result).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("RSC-3: no model gives no_model", () => {
    const custom = createFakeProvider("custom-1");
    const registry = createProviderRegistry([]);
    const result = resolveActiveProvider({
      settings: baseSettings({ model: null }),
      registry,
      readApiKey: () => "k",
      customProvider: custom,
    });
    expect(result).toEqual({ ok: false, reason: "no_model" });
  });

  it("RSC-4: settings name a custom id but customProvider is null or has a different id -> unknown_provider", () => {
    const registry = createProviderRegistry([]);
    const readApiKey = vi.fn();
    expect(
      resolveActiveProvider({ settings: baseSettings(), registry, readApiKey, customProvider: null }),
    ).toEqual({ ok: false, reason: "unknown_provider" });
    expect(
      resolveActiveProvider({
        settings: baseSettings(),
        registry,
        readApiKey,
        customProvider: createFakeProvider("custom-2"),
      }),
    ).toEqual({ ok: false, reason: "unknown_provider" });
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it("RSC-5: preset resolution is identical with customProvider set but not matching", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    const customProvider = createFakeProvider("custom-1");
    const result = resolveActiveProvider({
      settings: { provider: "gemini", model: "m-1" },
      registry,
      readApiKey: () => "k",
      customProvider,
    });
    expect(result).toEqual({ ok: true, provider: gemini, model: "m-1", apiKey: "k" });
  });
});
