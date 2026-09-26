import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../../../test/helpers/ai-fakes";
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

  it("PR-5: the shipped registry is empty (US-026 replaces this with: registry ids equal PROVIDER_IDS, DEC-017 §3)", () => {
    expect(SHIPPED_PROVIDER_ADAPTERS).toHaveLength(0);
    expect(createDefaultProviderRegistry().list()).toEqual([]);
  });
});
