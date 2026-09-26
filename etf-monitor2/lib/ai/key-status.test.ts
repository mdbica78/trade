import { afterEach, describe, expect, it, vi } from "vitest";
import { getKeyStatuses, readApiKey } from "./key-status";
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

  it("KS-3: readApiKey returns each provider's own sentinel, and no other provider's", () => {
    for (const provider of PROVIDER_CATALOG) {
      vi.stubEnv(provider.apiKeyEnvVar, `SENTINEL-${provider.id.toUpperCase()}-7d1e`);
    }
    for (const provider of PROVIDER_CATALOG) {
      expect(readApiKey(provider.id)).toBe(`SENTINEL-${provider.id.toUpperCase()}-7d1e`);
    }
    const other = PROVIDER_CATALOG[1];
    expect(readApiKey(PROVIDER_CATALOG[0].id)).not.toBe(readApiKey(other.id));
  });

  it("KS-4: unset, empty and blank give null; a value is trimmed", () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    expect(readApiKey("gemini")).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(readApiKey("gemini")).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "   ");
    expect(readApiKey("gemini")).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "  SENTINEL-X \n");
    expect(readApiKey("gemini")).toBe("SENTINEL-X");
  });

  it("KS-5: only a catalogue provider id is accepted, never an arbitrary env var name", () => {
    expect(readApiKey("foo")).toBeNull();
    expect(readApiKey("PATH")).toBeNull();
    expect(readApiKey("GEMINI_API_KEY")).toBeNull();
  });
});
