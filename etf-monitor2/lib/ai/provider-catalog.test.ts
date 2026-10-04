import { describe, expect, it } from "vitest";
import { findProvider, PROVIDER_CATALOG, PROVIDER_IDS } from "./provider-catalog";

describe("PROVIDER_CATALOG (PC-1)", () => {
  it("has exactly the two shipped provider ids, in order (sprint 6 decision 5)", () => {
    expect(PROVIDER_IDS).toEqual(["gemini", "groq"]);
  });

  it("has unique ids and unique apiKeyEnvVar values", () => {
    const ids = PROVIDER_CATALOG.map((p) => p.id);
    const vars = PROVIDER_CATALOG.map((p) => p.apiKeyEnvVar);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("every apiKeyEnvVar matches the *_API_KEY shape", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.apiKeyEnvVar).toMatch(/^[A-Z][A-Z0-9_]*_API_KEY$/);
    }
  });

  it("every provider requires an API key and has a non-empty name", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.requiresApiKey).toBe(true);
      expect(provider.name.length).toBeGreaterThan(0);
    }
  });

  it("PC-2 (US-041 AC3): every provider has at least one non-empty, unique, trimmed static model suggestion", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.modelSuggestions.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const suggestion of provider.modelSuggestions) {
        expect(suggestion.length).toBeGreaterThan(0);
        expect(suggestion.trim()).toBe(suggestion);
        expect(seen.has(suggestion)).toBe(false);
        seen.add(suggestion);
      }
    }
  });

  it("PC-3 (US-041 AC1): no third preset — the roster stays exactly gemini and groq until the PO names another vendor", () => {
    expect(PROVIDER_CATALOG).toHaveLength(2);
  });
});

describe("findProvider", () => {
  it("finds a known provider by id", () => {
    expect(findProvider("groq")?.name).toBe("Groq");
  });

  it("returns undefined for an unknown id or null", () => {
    expect(findProvider("openai")).toBeUndefined();
    expect(findProvider(null)).toBeUndefined();
  });
});
