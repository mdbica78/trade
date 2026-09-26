import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setAiSettings = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/ai/settings-deps", () => ({ createAiSettingsDeps: () => ({}) }));
vi.mock("@/lib/config/ai-settings", () => ({
  setAiSettings: (...args: unknown[]) => setAiSettings(...args),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it("AA-7: getDb/createAiSettingsDeps throwing gives the same generic error state", async () => {
    setAiSettings.mockRejectedValue(new Error("MissingDatabaseUrlError"));
    const { saveAiSettingsAction } = await import("./actions");
    const state = await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
  });

  it("AA-8: no network call during the action", async () => {
    setAiSettings.mockResolvedValue({ ok: true, provider: "groq", model: "m" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { saveAiSettingsAction } = await import("./actions");
    await saveAiSettingsAction({ status: "idle" }, formData({ provider: "groq", model: "m" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
