import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./providers/registry";
import { runGeneration } from "./providers/run-generation";
import { createProviderDeps, getAiAvailability, loadActiveProvider, type ProviderDeps } from "./provider-deps";

vi.mock("../db/index", () => ({ getDb: vi.fn(() => ({})) }));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    registry: createProviderRegistry([createFakeProvider("gemini")]),
    readApiKey: () => "SENTINEL-GEMINI-7d1e",
    fetch: vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
    ...overrides,
  };
}

describe("PD: provider-deps wiring", () => {
  it("PD-1: loadActiveProvider ok carries the key, model and injected fetch to the adapter context", async () => {
    const deps = makeDeps();
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (call.ok) {
      expect(call.input.apiKey).toBe("SENTINEL-GEMINI-7d1e");
      expect(call.input.model).toBe("m-1");
      expect(call.input.fetch).toBe(deps.fetch);
    }
  });

  it("PD-2: failure paths never leak a sentinel", async () => {
    const cases: ProviderDeps[] = [
      makeDeps({ loadSettings: async () => ({ provider: "gemini", model: null }) }),
      makeDeps({ registry: createProviderRegistry([]) }),
      makeDeps({ loadSettings: async () => ({ provider: "foo", model: "m-1" }) }),
      makeDeps({ loadSettings: async () => ({ provider: null, model: null }) }),
      makeDeps({ readApiKey: () => null }),
    ];
    for (const deps of cases) {
      const call = await loadActiveProvider(deps);
      const availability = await getAiAvailability(deps);
      expect(JSON.stringify(call)).not.toContain("SENTINEL");
      expect(JSON.stringify(availability)).not.toContain("SENTINEL");
    }
  });

  it("PD-3: getAiAvailability for the ok case is key-free", async () => {
    const deps = makeDeps();
    const availability = await getAiAvailability(deps);
    expect(availability).toEqual({ available: true, providerId: "gemini", model: "m-1" });
    expect(JSON.stringify(availability)).not.toContain("SENTINEL");
  });

  it("PD-4: no resolution branch (including ok) calls the injected fetch or the global fetch", async () => {
    const globalFetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const deps = makeDeps();
    await loadActiveProvider(deps);
    await getAiAvailability(deps);
    await loadActiveProvider(makeDeps({ readApiKey: () => null }));
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  it("PD-5: an adapter's own error or thrown value never leaks a sentinel through runGeneration", async () => {
    const throwingProvider = createFakeProvider("gemini", [{ throws: new Error("bad key SENTINEL-GEMINI-7d1e") }]);
    const deps = makeDeps({ registry: createProviderRegistry([throwingProvider]) });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (call.ok) {
      const result = await runGeneration(call.provider, { system: "s", user: "u", json: false, maxOutputTokens: 10 }, call.input);
      expect(JSON.stringify(result)).not.toContain("SENTINEL");
    }

    const erroringProvider = createFakeProvider("gemini", [{ ok: false, error: "auth_failed" }]);
    const deps2 = makeDeps({ registry: createProviderRegistry([erroringProvider]) });
    const call2 = await loadActiveProvider(deps2);
    if (call2.ok) {
      const result2 = await runGeneration(call2.provider, { system: "s", user: "u", json: false, maxOutputTokens: 10 }, call2.input);
      expect(result2).toEqual({ ok: false, error: "auth_failed" });
    }
  });

  it("PD-7: createProviderDeps with DATABASE_URL and every key var unset does not throw, and its fetch delegates to the stubbed global", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("GROQ_API_KEY", undefined);
    vi.stubEnv("OPENROUTER_API_KEY", undefined);
    vi.stubEnv("MISTRAL_API_KEY", undefined);
    const { getDb } = await import("../db/index");

    expect(() => createProviderDeps()).not.toThrow();
    expect(getDb).not.toHaveBeenCalled();

    const deps = createProviderDeps();
    await expect(deps.fetch("https://x", {})).rejects.toThrow("real network forbidden");
  });
});
