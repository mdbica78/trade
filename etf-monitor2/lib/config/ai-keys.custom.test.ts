import { describe, expect, it, vi } from "vitest";
import { clearProviderKey, saveProviderKey, type AiKeyConfigDeps } from "./ai-keys";

const FAKE_KEY = "test-key-0000-custom-SENTINEL";

function makeDeps(overrides: Partial<AiKeyConfigDeps> = {}): AiKeyConfigDeps {
  return {
    providers: [{ id: "gemini", requiresApiKey: true }],
    storageEnabled: true,
    writeEncrypted: vi.fn(async () => {}),
    clearStored: vi.fn(async () => {}),
    loadCustomProviders: vi.fn(async () => [{ id: "custom-1", baseUrl: "https://api.example.com/v1" }]),
    ...overrides,
  };
}

describe("custom-provider key configuration (AKC)", () => {
  it("AKC-1: a custom id found by loadCustomProviders writes with its baseUrl", async () => {
    const deps = makeDeps();
    const result = await saveProviderKey({ providerId: "custom-1", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: true });
    const call = vi.mocked(deps.writeEncrypted).mock.calls[0];
    expect(call).toEqual(["custom-1", FAKE_KEY, "https://api.example.com/v1"]);
  });

  it("AKC-2: a custom id not in the list gives unknown_provider and never writes", async () => {
    const deps = makeDeps();
    const result = await saveProviderKey({ providerId: "custom-2", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: false, error: "unknown_provider" });
    expect(deps.writeEncrypted).not.toHaveBeenCalled();
  });

  it("AKC-3: without loadCustomProviders, a custom id gives unknown_provider", async () => {
    const deps = makeDeps({ loadCustomProviders: undefined });
    const result = await saveProviderKey({ providerId: "custom-1", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: false, error: "unknown_provider" });
    expect(deps.writeEncrypted).not.toHaveBeenCalled();
  });

  it("AKC-4: a preset is still called with exactly 2 arguments", async () => {
    const deps = makeDeps();
    await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, deps);
    const call = vi.mocked(deps.writeEncrypted).mock.calls[0];
    expect(call).toEqual(["gemini", FAKE_KEY]);
    expect(call.length).toBe(2);
  });

  it("AKC-5: clear works for an existing custom id", async () => {
    const deps = makeDeps();
    const result = await clearProviderKey("custom-1", deps);
    expect(result).toEqual({ ok: true });
    expect(deps.clearStored).toHaveBeenCalledWith("custom-1");
  });

  it("AKC-6: the fake key sentinel never appears in any result", async () => {
    const deps = makeDeps();
    const results = await Promise.all([
      saveProviderKey({ providerId: "custom-1", key: FAKE_KEY }, deps),
      saveProviderKey({ providerId: "custom-2", key: FAKE_KEY }, deps),
      clearProviderKey("custom-1", deps),
    ]);
    for (const result of results) {
      expect(JSON.stringify(result).includes(FAKE_KEY)).toBe(false);
    }
  });
});
