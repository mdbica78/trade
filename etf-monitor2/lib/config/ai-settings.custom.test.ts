import { describe, expect, it, vi } from "vitest";
import { setAiSettings, type AiSettingsDeps } from "./ai-settings";

function fakeDeps(overrides: Partial<AiSettingsDeps> = {}): { deps: AiSettingsDeps; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => [[]]);
  const db = { execute: vi.fn((query: unknown) => query) } as unknown as AiSettingsDeps["db"];
  const deps: AiSettingsDeps = {
    db,
    run: run as unknown as AiSettingsDeps["run"],
    providerIds: ["gemini", "groq"],
    ...overrides,
  };
  return { deps, run };
}

describe("setAiSettings custom-provider ids (ASC)", () => {
  it("ASC-1: a custom id is accepted when loadCustomProviderIds includes it", async () => {
    const loadCustomProviderIds = vi.fn(async () => ["custom-1", "custom-2"]);
    const { deps } = fakeDeps({ loadCustomProviderIds });
    const result = await setAiSettings({ provider: "custom-1", model: "m" }, deps);
    expect(result).toEqual({ ok: true, provider: "custom-1", model: "m" });
    expect(loadCustomProviderIds).toHaveBeenCalledTimes(1);
  });

  it("ASC-2: otherwise unknown_provider and no run call", async () => {
    const loadCustomProviderIds = vi.fn(async () => ["custom-2"]);
    const { deps, run } = fakeDeps({ loadCustomProviderIds });
    const result = await setAiSettings({ provider: "custom-1", model: "m" }, deps);
    expect(result).toEqual({ ok: false, error: "unknown_provider" });
    expect(run).not.toHaveBeenCalled();
  });

  it("ASC-3: a preset id never calls loadCustomProviderIds", async () => {
    const loadCustomProviderIds = vi.fn(async () => ["custom-1"]);
    const { deps } = fakeDeps({ loadCustomProviderIds });
    const result = await setAiSettings({ provider: "gemini", model: "m" }, deps);
    expect(result).toEqual({ ok: true, provider: "gemini", model: "m" });
    expect(loadCustomProviderIds).not.toHaveBeenCalled();
  });
});
