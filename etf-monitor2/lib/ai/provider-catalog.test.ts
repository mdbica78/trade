import { describe, expect, it } from "vitest";
import { findProvider, PROVIDER_CATALOG, PROVIDER_IDS } from "./provider-catalog";

describe("PROVIDER_CATALOG (PC-1)", () => {
  it("has exactly the eight shipped provider ids, in order (DEC-026 §1)", () => {
    expect(PROVIDER_IDS).toEqual([
      "gemini",
      "groq",
      "openai",
      "openrouter",
      "mistral",
      "deepseek",
      "cerebras",
      "together",
    ]);
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

  it("PC-3 (DEC-026 §1): exactly 8 presets, the DEC-026 roster", () => {
    expect(PROVIDER_CATALOG).toHaveLength(8);
  });

  it("PC-4 (US-056 DEC-026 §3): Groq suggestions are strongest-first", () => {
    const groq = PROVIDER_CATALOG.find((p) => p.id === "groq");
    expect(groq?.modelSuggestions[0]).toBe("openai/gpt-oss-120b");
    expect(groq?.modelSuggestions[1]).toBe("llama-3.3-70b-versatile");
    const smallIndex = groq?.modelSuggestions.indexOf("openai/gpt-oss-20b") ?? -1;
    const smallestIndex = groq?.modelSuggestions.indexOf("llama-3.1-8b-instant") ?? -1;
    expect(smallIndex).toBeGreaterThan(1);
    expect(smallestIndex).toBeGreaterThan(1);
  });

  it("PC-5 (US-056 AC2): exact id -> apiKeyEnvVar map of all eight", () => {
    const map = Object.fromEntries(PROVIDER_CATALOG.map((p) => [p.id, p.apiKeyEnvVar]));
    expect(map).toEqual({
      gemini: "GEMINI_API_KEY",
      groq: "GROQ_API_KEY",
      openai: "OPENAI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      mistral: "MISTRAL_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      cerebras: "CEREBRAS_API_KEY",
      together: "TOGETHER_API_KEY",
    });
  });
});

describe("findProvider", () => {
  it("finds a known provider by id", () => {
    expect(findProvider("groq")?.name).toBe("Groq");
  });

  it("returns undefined for an unknown id or null", () => {
    expect(findProvider("anthropic")).toBeUndefined();
    expect(findProvider(null)).toBeUndefined();
  });
});
