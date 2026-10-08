import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setAiSettings = vi.fn();
const saveProviderKey = vi.fn();
const clearProviderKey = vi.fn();
const testProviderConnection = vi.fn();
const revalidatePath = vi.fn();
let mockGetDb: () => unknown = () => ({});
let mockCreateAiSettingsDeps: () => unknown = () => ({});
const mockCreateProviderKeyConfigDeps = vi.fn(() => ({}));

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => mockGetDb() }));
vi.mock("@/lib/ai/settings-deps", () => ({
  createAiSettingsDeps: () => mockCreateAiSettingsDeps(),
  createProviderKeyConfigDeps: () => mockCreateProviderKeyConfigDeps(),
}));
vi.mock("@/lib/config/ai-settings", () => ({
  setAiSettings: (...args: unknown[]) => setAiSettings(...args),
}));
vi.mock("@/lib/config/ai-keys", () => ({
  saveProviderKey: (...args: unknown[]) => saveProviderKey(...args),
  clearProviderKey: (...args: unknown[]) => clearProviderKey(...args),
}));
vi.mock("@/lib/ai/connection-test", () => ({
  testProviderConnection: (...args: unknown[]) => testProviderConnection(...args),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDb = () => ({});
  mockCreateAiSettingsDeps = () => ({});
  mockCreateProviderKeyConfigDeps.mockReset().mockReturnValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("saveAiSettingsAction (AA)", () => {
  it("AA-1: calls setAiSettings with exactly {provider, model}, ignoring apiKey / env-shaped extra fields", async () => {
    setAiSettings.mockResolvedValue({ ok: true, provider: "groq", model: "m" });
    vi.stubEnv("GEMINI_API_KEY", "SENTINEL-X");
    const { saveAiSettingsAction } = await import("./actions");
    await saveAiSettingsAction(
      { status: "idle" },
      formData({
        provider: "groq",
        model: "m",
        apiKey: "SENTINEL-X",
        GEMINI_API_KEY: "SENTINEL-X",
        cron_hour_utc: "3",
        default_locale: "en",
      }),
    );
    expect(setAiSettings).toHaveBeenCalledWith({ provider: "groq", model: "m" }, {});
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ai");
  });

  it("AA-2 (US-041 AC2): a form-injected baseUrl is never forwarded and cannot change which provider is saved", async () => {
    setAiSettings.mockResolvedValue({ ok: true, provider: "gemini", model: "m" });
    const { saveAiSettingsAction } = await import("./actions");
    await saveAiSettingsAction(
      { status: "idle" },
      formData({ provider: "gemini", model: "m", baseUrl: "https://evil.example.com/steal" }),
    );
    expect(setAiSettings).toHaveBeenCalledWith({ provider: "gemini", model: "m" }, {});
    expect(setAiSettings).not.toHaveBeenCalledWith(expect.objectContaining({ baseUrl: expect.anything() }), expect.anything());
  });

  it("invalid request (missing model field) never calls setAiSettings or revalidatePath", async () => {
    const { saveAiSettingsAction } = await import("./actions");
    const state = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(setAiSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a not-ok result never revalidates", async () => {
    setAiSettings.mockResolvedValue({ ok: false, error: "unknown_provider" });
    const { saveAiSettingsAction } = await import("./actions");
    await saveAiSettingsAction({ status: "idle" }, formData({ provider: "nope", model: "" }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AA-6: a thrown secret-shaped error returns the generic error, never the message, never revalidates", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:secret@h/db");
    vi.stubEnv("GEMINI_API_KEY", "SENTINEL-X");
    setAiSettings.mockRejectedValue(new Error("connection refused: postgres://user:secret@db.example.com/etfs"));
    const { saveAiSettingsAction } = await import("./actions");
    const state = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("connection refused");
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("SENTINEL");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AA-7: setAiSettings rejecting with a database-shaped error gives the same generic error state", async () => {
    setAiSettings.mockRejectedValue(new Error("MissingDatabaseUrlError"));
    const { saveAiSettingsAction } = await import("./actions");
    const state = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
  });

  it("AA-7b: getDb() or createAiSettingsDeps() throwing synchronously gives the generic error state, never calls setAiSettings/revalidatePath, no secret text", async () => {
    const secretMessage = "connection refused: postgres://user:secret@db.example.com/etfs";

    mockGetDb = () => {
      throw new Error(secretMessage);
    };
    const { saveAiSettingsAction } = await import("./actions");
    const stateA = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(stateA).toEqual({ status: "error", messageKey: "genericError" });
    expect(setAiSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(JSON.stringify(stateA)).not.toContain("secret");

    mockGetDb = () => ({});
    mockCreateAiSettingsDeps = () => {
      throw new Error(secretMessage);
    };
    const stateB = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(stateB).toEqual({ status: "error", messageKey: "genericError" });
    expect(setAiSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(JSON.stringify(stateB)).not.toContain("secret");
  });

  it("AA-8: no network call during the action", async () => {
    setAiSettings.mockResolvedValue({ ok: true, provider: "groq", model: "m" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { saveAiSettingsAction } = await import("./actions");
    await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AAK-1: save passes only providerId/key to configuration, ignores baseUrl, and revalidates on success", async () => {
    const fakeKey = "test-key-0000-server-action";
    saveProviderKey.mockResolvedValue({ ok: true });
    const { saveProviderKeyAction } = await import("./actions");
    const state = await saveProviderKeyAction(
      { status: "idle" },
      formData({ providerId: "gemini", key: fakeKey, baseUrl: "https://fake.invalid" }),
    );
    const call = saveProviderKey.mock.calls[0];
    expect(call?.[0]?.providerId === "gemini" && call[0]?.key === fakeKey && call.length === 2).toBe(true);
    expect(state).toEqual({ status: "success", messageKey: "providerKeySaved" });
    expect(JSON.stringify(state).includes(fakeKey)).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ai");
  });

  it("AAK-2: clear passes only the selected provider to configuration", async () => {
    clearProviderKey.mockResolvedValue({ ok: true });
    const { clearProviderKeyAction } = await import("./actions");
    const state = await clearProviderKeyAction(
      { status: "idle" },
      formData({ providerId: "groq", baseUrl: "https://fake.invalid", key: "ignored" }),
    );
    const call = clearProviderKey.mock.calls[0];
    expect(call?.[0] === "groq" && call.length === 2).toBe(true);
    expect(state).toEqual({ status: "success", messageKey: "providerKeyCleared" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ai");
  });

  it("AAK-3: malformed save/clear forms do not construct config dependencies or revalidate", async () => {
    const { saveProviderKeyAction, clearProviderKeyAction } = await import("./actions");
    const saveState = await saveProviderKeyAction({ status: "idle" }, formData({ providerId: "gemini" }));
    const clearState = await clearProviderKeyAction({ status: "idle" }, formData({}));
    expect(saveState).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(clearState).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(mockCreateProviderKeyConfigDeps).not.toHaveBeenCalled();
    expect(saveProviderKey).not.toHaveBeenCalled();
    expect(clearProviderKey).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AAK-4: thrown key-shaped dependency errors return a generic key-free state", async () => {
    const fakeKey = "test-key-0000-thrown-action";
    saveProviderKey.mockRejectedValue(new Error(`write failed ${fakeKey} https://fake.invalid`));
    const { saveProviderKeyAction } = await import("./actions");
    const state = await saveProviderKeyAction(
      { status: "idle" },
      formData({ providerId: "gemini", key: fakeKey }),
    );
    const serialized = JSON.stringify(state);
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    expect(serialized.includes(fakeKey) || serialized.includes("fake.invalid")).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AAK-5: invalid config result uses a closed error message and does not revalidate", async () => {
    saveProviderKey.mockResolvedValue({ ok: false, error: "key_invalid" });
    const { saveProviderKeyAction } = await import("./actions");
    const state = await saveProviderKeyAction(
      { status: "idle" },
      formData({ providerId: "gemini", key: "fake key" }),
    );
    expect(state).toEqual({ status: "error", messageKey: "providerKeyInvalid" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AAK-6: no network call occurs while saving or clearing a key", async () => {
    saveProviderKey.mockResolvedValue({ ok: true });
    clearProviderKey.mockResolvedValue({ ok: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { saveProviderKeyAction, clearProviderKeyAction } = await import("./actions");
    await saveProviderKeyAction({ status: "idle" }, formData({ providerId: "gemini", key: "test-key-0000-fake" }));
    await clearProviderKeyAction({ status: "idle" }, formData({ providerId: "gemini" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("TC-1 (US-056): testConnectionAction ignores every form field (including baseUrl), calls testProviderConnection with zero arguments, no revalidation on success", async () => {
    testProviderConnection.mockResolvedValue({ ok: true });
    const { testConnectionAction } = await import("./actions");
    const state = await testConnectionAction(
      { status: "idle" },
      formData({ provider: "openai", model: "gpt-4.1", baseUrl: "https://evil.example.com/steal", apiKey: "SENTINEL" }),
    );
    expect(testProviderConnection).toHaveBeenCalledWith();
    expect(state).toEqual({ status: "success", messageKey: "connectionOk" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("TC-2 (US-056): auth_failed gives the exact error state with values.code", async () => {
    testProviderConnection.mockResolvedValue({ ok: false, code: "auth_failed" });
    const { testConnectionAction } = await import("./actions");
    const state = await testConnectionAction({ status: "idle" }, formData({}));
    expect(state).toEqual({ status: "error", messageKey: "connectionFailed", values: { code: "auth_failed" } });
  });

  it("TC-3 (US-056): a rejection with a sentinel/postgres:// message gives genericError, no sentinel", async () => {
    testProviderConnection.mockRejectedValue(new Error("connection refused: postgres://user:secret@db.example.com/etfs"));
    const { testConnectionAction } = await import("./actions");
    const state = await testConnectionAction({ status: "idle" }, formData({}));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("secret");
  });
});
