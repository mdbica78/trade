import { afterEach, describe, expect, it, vi } from "vitest";
import { getKeyStatuses } from "./key-status";
import { PROVIDER_CATALOG } from "./provider-catalog";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getKeyStatuses (KS)", () => {
  it("KS-1: one entry per catalogue provider, in order, isSet true when set, never leaks the value", () => {
    for (const provider of PROVIDER_CATALOG) {
      vi.stubEnv(provider.apiKeyEnvVar, `SENTINEL-${provider.id}-9f3c`);
    }
    const result = getKeyStatuses();
    expect(result.map((r) => r.id)).toEqual(PROVIDER_CATALOG.map((p) => p.id));
    for (const entry of result) {
      expect(entry.isSet).toBe(true);
      expect(typeof entry.isSet).toBe("boolean");
      expect(Object.keys(entry).sort()).toEqual(["apiKeyEnvVar", "id", "isSet", "name", "requiresApiKey"].sort());
    }
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });

  it("KS-2: blank or unset variables are isSet: false", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "   ");
    vi.stubEnv("OPENROUTER_API_KEY", undefined);
    vi.stubEnv("MISTRAL_API_KEY", undefined);
    const result = getKeyStatuses();
    for (const entry of result) {
      expect(entry.isSet).toBe(false);
    }
  });
});
