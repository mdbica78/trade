import { describe, expect, it } from "vitest";
import { findProvider, PROVIDER_CATALOG, PROVIDER_IDS } from "./provider-catalog";

describe("PROVIDER_CATALOG (PC-1)", () => {
  it("has exactly the four FR6 provider ids, in order", () => {
    expect(PROVIDER_IDS).toEqual(["gemini", "groq", "openrouter", "mistral"]);
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
