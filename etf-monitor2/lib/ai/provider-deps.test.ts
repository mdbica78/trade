import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { PROVIDER_CATALOG } from "./provider-catalog";
import { createProviderRegistry } from "./providers/registry";
import { runGeneration } from "./providers/run-generation";
import {
  createProviderDeps,
  getAiAvailability,
  loadActiveProvider,
  loadStoredProviderKeys,
  type ProviderDeps,
} from "./provider-deps";

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
    loadStoredKeys: async () => new Map(),
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
      const result = await runGeneration(call.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call.input);
      expect(JSON.stringify(result)).not.toContain("SENTINEL");
    }

    const erroringProvider = createFakeProvider("gemini", [{ ok: false, error: "auth_failed" }]);
    const deps2 = makeDeps({ registry: createProviderRegistry([erroringProvider]) });
    const call2 = await loadActiveProvider(deps2);
    if (call2.ok) {
      const result2 = await runGeneration(call2.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call2.input);
      expect(result2).toEqual({ ok: false, error: "auth_failed" });
    }
  });

  it("PD-7: createProviderDeps with DATABASE_URL and every key var unset does not throw, and its fetch delegates to the stubbed global", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    for (const provider of PROVIDER_CATALOG) {
      vi.stubEnv(provider.apiKeyEnvVar, undefined);
    }
    const { getDb } = await import("../db/index");

    expect(() => createProviderDeps()).not.toThrow();
    expect(getDb).not.toHaveBeenCalled();

    const deps = createProviderDeps();
    await expect(deps.fetch("https://x", {})).rejects.toThrow("real network forbidden");
  });

  it("PD-8: a stored key wins over the environment key and is loaded before synchronous resolution", async () => {
    const order: string[] = [];
    const storedKey = "SENTINEL-STORED-GEMINI-8a1f";
    const deps = makeDeps({
      loadSettings: async () => {
        order.push("settings");
        return { provider: "gemini", model: "m-1" };
      },
      loadStoredKeys: async () => {
        order.push("stored-start");
        await Promise.resolve();
        order.push("stored-ready");
        return new Map([
          [
            "gemini",
            { key: storedKey, keySource: "master" as const, updatedAt: new Date("2026-10-02T12:00:00Z") },
          ],
        ]);
      },
      readApiKey: () => {
        order.push("environment-read");
        return "SENTINEL-ENV-GEMINI-1c4e";
      },
    });

    const call = await loadActiveProvider(deps);

    expect(call.ok && call.input.apiKey === storedKey).toBe(true);
    expect(order).toEqual(["settings", "stored-start", "stored-ready"]);
  });

  it("PD-9: read failure for one provider is sanitized and leaves another stored provider usable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const stored = await loadStoredProviderKeys({} as never, async (_db, providerId) => {
      if (providerId === "gemini") throw new Error("fake database url and submitted key must not escape");
      if (providerId === "groq") {
        return {
          key: "SENTINEL-STORED-GROQ-2e5c",
          keySource: "master",
          updatedAt: new Date("2026-10-02T12:00:00Z"),
        };
      }
      return null;
    });
    const logged = spy.mock.calls.map((call) => String(call[0]));
    spy.mockRestore();
    const deps = makeDeps({
      loadSettings: async () => ({ provider: "groq", model: "m-1" }),
      registry: createProviderRegistry([createFakeProvider("groq")]),
      loadStoredKeys: async () => stored,
      readApiKey: () => null,
    });
    const call = await loadActiveProvider(deps);

    expect(stored.has("gemini")).toBe(false);
    expect(stored.has("groq")).toBe(true);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/^\[load-error\] ai\/provider-key\/gemini /);
    expect(logged[0].includes("submitted key") || logged[0].includes("database url")).toBe(false);
    expect(call.ok && call.input.apiKey === "SENTINEL-STORED-GROQ-2e5c").toBe(true);
  });

  it("PD-N1 (US-055 T-14): loadActiveProvider carries the catalogue display name for a preset provider", async () => {
    const deps = makeDeps();
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (call.ok) expect(call.providerName).toBe("Google Gemini");
  });

  it("PD-10: an absent table is a no-stored-key state without noisy logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const read = vi.fn(async () => {
      throw Object.assign(new Error("missing relation"), { code: "42P01" });
    });
    const stored = await loadStoredProviderKeys({} as never, read as never);
    expect(stored.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
