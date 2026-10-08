import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import type { CustomProvider } from "../config/custom-providers";
import { createProviderRegistry } from "./providers/registry";
import {
  getCustomProviderViews,
  loadActiveProvider,
  loadStoredProviderKeys,
  type ProviderDeps,
} from "./provider-deps";

const FAKE_KEY = "test-key-0000-custom-SENTINEL";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return {
    loadSettings: async () => ({ provider: "custom-1", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([]),
    readApiKey: () => "ENV-SENTINEL",
    fetch: vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
    loadCustomProviders: async () => [{ id: "custom-1", name: "Groq via custom", baseUrl: "https://api.example.com/v1" }],
    ...overrides,
  };
}

describe("provider-deps resolution with custom providers (PDX)", () => {
  it("PDX-1: a selected custom provider loads custom providers once and stored keys with [custom], posting once to <base>/chat/completions", async () => {
    const loadCustomProviders = vi.fn(async () => [
      { id: "custom-1", name: "Groq via custom", baseUrl: "https://api.example.com/v1" },
    ]);
    const loadStoredKeys = vi.fn(async (_customs?: readonly CustomProvider[]) =>
      new Map([["custom-1", { key: FAKE_KEY, keySource: "master" as const, updatedAt: new Date() }]]),
    );
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    const deps = makeDeps({ loadCustomProviders, loadStoredKeys, fetch: fetchSpy });

    const call = await loadActiveProvider(deps);
    expect(loadCustomProviders).toHaveBeenCalledTimes(1);
    expect(loadStoredKeys.mock.calls[0][0]).toEqual([{ id: "custom-1", name: "Groq via custom", baseUrl: "https://api.example.com/v1" }]);
    expect(call.ok).toBe(true);
    if (call.ok) {
      await call.provider.generate(
        { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 },
        { apiKey: call.input.apiKey, model: call.input.model, fetch: call.input.fetch, signal: new AbortController().signal },
      );
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.example.com/v1/chat/completions");
  });

  it("PDX-2: a preset is selected: loadCustomProviders is never called and loadStoredKeys gets no argument", async () => {
    const loadCustomProviders = vi.fn(async () => [{ id: "custom-1", name: "x", baseUrl: "https://api.example.com/v1" }]);
    const loadStoredKeys = vi.fn(async () => new Map());
    const gemini = createFakeProvider("gemini");
    const deps = makeDeps({
      loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
      registry: createProviderRegistry([gemini]),
      loadCustomProviders,
      loadStoredKeys,
      readApiKey: () => "k",
    });
    const call = await loadActiveProvider(deps);
    expect(loadCustomProviders).not.toHaveBeenCalled();
    expect(loadStoredKeys.mock.calls[0]).toEqual([]);
    expect(call.ok).toBe(true);
  });

  it("PDX-3: custom with no stored key but readApiKey returning an env sentinel gives no_api_key; the sentinel is never used", async () => {
    const deps = makeDeps({ loadStoredKeys: async () => new Map(), readApiKey: () => "ENV-SENTINEL" });
    const call = await loadActiveProvider(deps);
    expect(call).toEqual({ ok: false, reason: "no_api_key" });
    expect(JSON.stringify(call)).not.toContain("ENV-SENTINEL");
  });

  it("PDX-4: a custom id that is not listed gives unknown_provider", async () => {
    const deps = makeDeps({ loadCustomProviders: async () => [] });
    const call = await loadActiveProvider(deps);
    expect(call).toEqual({ ok: false, reason: "unknown_provider" });
  });

  it("PDX-5: a loadCustomProviders rejection propagates and no request is made", async () => {
    const fetchSpy = vi.fn();
    const deps = makeDeps({
      loadCustomProviders: async () => {
        throw new Error("db unavailable");
      },
      fetch: fetchSpy,
    });
    await expect(loadActiveProvider(deps)).rejects.toThrow("db unavailable");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PDX-6: getCustomProviderViews builds key-free views; a failure logs one sanitised line without the sentinel", async () => {
    const list = vi.fn(async () => [{ id: "custom-1", name: "Groq via custom", baseUrl: "https://api.example.com/v1" }]);
    const reader = vi.fn(async () => ({ key: FAKE_KEY, keySource: "master" as const, updatedAt: new Date("2026-10-06T00:00:00Z") }));
    const ok = await getCustomProviderViews({ db: {} as never, list, reader });
    expect(ok).toEqual({
      status: "ok",
      providers: [
        { id: "custom-1", name: "Groq via custom", baseUrl: "https://api.example.com/v1", keySet: true, updatedAt: "2026-10-06T00:00:00.000Z" },
      ],
    });
    expect(JSON.stringify(ok)).not.toContain(FAKE_KEY);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = await getCustomProviderViews({
      db: {} as never,
      list: async () => {
        throw new Error(`boom ${FAKE_KEY}`);
      },
      reader,
    });
    expect(failing).toEqual({ status: "error" });
    const logged = spy.mock.calls.map((call) => String(call[0]));
    spy.mockRestore();
    expect(logged.some((line) => line.includes(FAKE_KEY))).toBe(false);
  });

  it("PD-N1 (US-055 T-14): loadActiveProvider carries the custom provider's stored name", async () => {
    const deps = makeDeps({ loadStoredKeys: async () => new Map([["custom-1", { key: FAKE_KEY, keySource: "master" as const, updatedAt: new Date() }]]) });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (call.ok) expect(call.providerName).toBe("Groq via custom");
  });

  it("PDX-7: loadStoredProviderKeys with customs reads a custom key only with its URL", async () => {
    const reader = vi.fn(async (_db: unknown, _id: string, _materialForSource?: unknown, _baseUrl?: string | null) => null);
    await loadStoredProviderKeys({} as never, reader as never, [
      { id: "custom-1", name: "x", baseUrl: "https://api.example.com/v1" },
    ]);
    const customCall = reader.mock.calls.find((call) => call[1] === "custom-1");
    expect(customCall?.[3]).toBe("https://api.example.com/v1");
  });
});
