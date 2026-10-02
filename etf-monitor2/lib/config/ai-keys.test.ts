import { describe, expect, it, vi } from "vitest";
import {
  clearProviderKey,
  saveProviderKey,
  type AiKeyConfigDeps,
} from "./ai-keys";

const FAKE_KEY = "test-key-0000-obvious-fake-material";

function makeDeps(overrides: Partial<AiKeyConfigDeps> = {}): AiKeyConfigDeps {
  return {
    providers: [
      { id: "gemini", requiresApiKey: true },
      { id: "groq", requiresApiKey: true },
      { id: "no-key-provider", requiresApiKey: false },
    ],
    storageEnabled: true,
    writeEncrypted: vi.fn(async () => {}),
    clearStored: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("provider-key configuration (AK)", () => {
  it("AK-1: trims a valid key and returns only a closed success result", async () => {
    const deps = makeDeps();
    const result = await saveProviderKey({ providerId: "gemini", key: `  ${FAKE_KEY}  ` }, deps);
    const call = vi.mocked(deps.writeEncrypted).mock.calls[0];
    expect(result).toEqual({ ok: true });
    expect(call?.[0] === "gemini" && call[1] === FAKE_KEY).toBe(true);
    expect(JSON.stringify(result).includes(FAKE_KEY)).toBe(false);
  });

  it.each([
    [{ providerId: "unknown", key: FAKE_KEY }, "unknown_provider"],
    [{ providerId: "no-key-provider", key: FAKE_KEY }, "unknown_provider"],
    [{ providerId: "gemini", key: null }, "key_invalid"],
    [{ providerId: "gemini", key: "short" }, "key_invalid"],
    [{ providerId: "gemini", key: "a".repeat(513) }, "key_invalid"],
    [{ providerId: "gemini", key: "fake key with spaces" }, "key_invalid"],
    [{ providerId: "gemini", key: "fake\tkey-0000" }, "key_invalid"],
  ] as const)("AK-2: invalid inputs return the specified closed code without writing", async (input, error) => {
    const deps = makeDeps();
    const result = await saveProviderKey(input, deps);
    expect(result).toEqual({ ok: false, error });
    expect(deps.writeEncrypted).not.toHaveBeenCalled();
    expect(JSON.stringify(result).includes(FAKE_KEY)).toBe(false);
  });

  it("AK-3: storage-disabled saves fail closed and do not invoke the writer", async () => {
    const deps = makeDeps({ storageEnabled: false });
    const result = await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: false, error: "storing_disabled" });
    expect(deps.writeEncrypted).not.toHaveBeenCalled();
  });

  it("AK-4: persistence errors become write_failed without exposing the key or exception", async () => {
    const deps = makeDeps({
      writeEncrypted: vi.fn(async () => {
        throw new Error(`database failure ${FAKE_KEY} postgres://fake.invalid`);
      }),
    });
    const result = await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: false, error: "write_failed" });
    const serialized = JSON.stringify(result);
    expect(serialized.includes(FAKE_KEY) || serialized.includes("postgres://")).toBe(false);
  });

  it("AK-5: clear accepts only a catalogued key provider and returns a closed result", async () => {
    const deps = makeDeps();
    expect(await clearProviderKey("gemini", deps)).toEqual({ ok: true });
    expect(deps.clearStored).toHaveBeenCalledTimes(1);
    expect(await clearProviderKey("not-a-provider", deps)).toEqual({ ok: false, error: "unknown_provider" });
    expect(deps.clearStored).toHaveBeenCalledTimes(1);
  });

  it("AK-6: clear failures do not leak exception text", async () => {
    const deps = makeDeps({
      clearStored: vi.fn(async () => {
        throw new Error(`clear failed ${FAKE_KEY}`);
      }),
    });
    const result = await clearProviderKey("groq", deps);
    expect(result).toEqual({ ok: false, error: "write_failed" });
    expect(JSON.stringify(result).includes(FAKE_KEY)).toBe(false);
  });
});
