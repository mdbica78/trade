import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../../../test/helpers/ai-fakes";
import { PROVIDER_IDS } from "../provider-catalog";
import { createProviderRegistry } from "./registry";
import { SHIPPED_PROVIDER_ADAPTERS, createDefaultProviderRegistry } from "./default-registry";

describe("PR: provider registry", () => {
  it("PR-1: get returns the same adapter object for each registered id; unknown/empty give undefined", () => {
    const gemini = createFakeProvider("gemini");
    const registry = createProviderRegistry([gemini]);
    expect(registry.get("gemini")).toBe(gemini);
    expect(registry.get("groq")).toBeUndefined();
    expect(registry.get("")).toBeUndefined();
  });

  it("PR-2: list() returns adapters in construction order; mutating it does not change the registry", () => {
    const gemini = createFakeProvider("gemini");
    const groq = createFakeProvider("groq");
    const registry = createProviderRegistry([gemini, groq]);
    const list = registry.list();
    expect(list).toEqual([gemini, groq]);
    (list as unknown as unknown[]).push(createFakeProvider("mistral"));
    expect(registry.list()).toHaveLength(2);
  });

  it("PR-3: a duplicate id throws", () => {
    const gemini = createFakeProvider("gemini");
    const geminiAgain = createFakeProvider("gemini");
    expect(() => createProviderRegistry([gemini, geminiAgain])).toThrow("duplicate provider id");
  });

  it("PR-4: an id not in PROVIDER_CATALOG throws; an empty list is valid", () => {
    expect(() => createProviderRegistry([createFakeProvider("foo")])).toThrow("provider id not in catalogue");
    expect(createProviderRegistry([]).list()).toEqual([]);
  });

  it("PR-5: the shipped registry's ids equal PROVIDER_IDS, in the same order (DEC-017 §3)", () => {
    expect(SHIPPED_PROVIDER_ADAPTERS.map((p) => p.id)).toEqual(PROVIDER_IDS);
    expect(createDefaultProviderRegistry().list().map((p) => p.id)).toEqual(PROVIDER_IDS);
  });

  it("PR-6: every shipped adapter is a function-shaped AiProvider reachable through the registry", () => {
    const registry = createDefaultProviderRegistry();
    for (const id of PROVIDER_IDS) {
      const adapter = registry.get(id);
      expect(adapter).toBeDefined();
      expect(typeof adapter?.generate).toBe("function");
    }
  });
});
