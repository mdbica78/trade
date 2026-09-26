import { describe, expect, it, vi } from "vitest";
import { setAiSettings, type AiSettingsDeps } from "./ai-settings";

function fakeDeps(overrides: Partial<AiSettingsDeps> = {}): { deps: AiSettingsDeps; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => [[]]);
  const db = { execute: vi.fn((query: unknown) => query) } as unknown as AiSettingsDeps["db"];
  const deps: AiSettingsDeps = {
    db,
    run: run as unknown as AiSettingsDeps["run"],
    providerIds: ["gemini", "groq", "openrouter", "mistral"],
    ...overrides,
  };
  return { deps, run };
}

describe("setAiSettings validation (AV)", () => {
  it("AV-1: an unknown or malformed provider is rejected, zero runner calls", async () => {
    const { deps, run } = fakeDeps();
    for (const bad of ["openai", "GROQ", 42, {}]) {
      const result = await setAiSettings({ provider: bad, model: null }, deps);
      expect(result).toEqual({ ok: false, error: "unknown_provider" });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("AV-2: a model over the length limit, or a non-string model, is rejected", async () => {
    const { deps, run } = fakeDeps();
    const tooLong = "x".repeat(201);
    expect(await setAiSettings({ provider: "groq", model: tooLong }, deps)).toEqual({
      ok: false,
      error: "invalid_model",
    });
    expect(await setAiSettings({ provider: "groq", model: 42 }, deps)).toEqual({
      ok: false,
      error: "invalid_model",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("AV-4: a provider with surrounding whitespace is trimmed and accepted", async () => {
    const { deps, run } = fakeDeps();
    const result = await setAiSettings({ provider: " groq ", model: null }, deps);
    expect(result).toEqual({ ok: true, provider: "groq", model: null });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("AV-5: clearing the provider ignores an otherwise-too-long model", async () => {
    const { deps, run } = fakeDeps();
    const result = await setAiSettings({ provider: "", model: "x".repeat(500) }, deps);
    expect(result).toEqual({ ok: true, provider: null, model: null });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
