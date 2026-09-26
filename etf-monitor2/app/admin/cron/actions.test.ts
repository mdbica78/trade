import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setCronHour = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createCronConfigDeps: () => ({}) }));
vi.mock("@/lib/config/cron", () => ({
  setCronHour: (...args: unknown[]) => setCronHour(...args),
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
  vi.unstubAllGlobals();
});

describe("saveCronHourAction (CA)", () => {
  it("CA-1: calls setCronHour with exactly the hour string, ignoring extra fields", async () => {
    setCronHour.mockResolvedValue({ ok: true, hour: 7 });
    const { saveCronHourAction } = await import("./actions");
    await saveCronHourAction(
      { status: "idle" },
      formData({ hour: "7", ai_provider: "groq", ai_model: "m", default_locale: "en", schedule: "0 7 * * *" }),
    );
    expect(setCronHour).toHaveBeenCalledWith("7", {});
    expect(revalidatePath).toHaveBeenCalledWith("/admin/cron");
  });

  it("CA-2: a missing hour field is an invalid request, no config call, no revalidate", async () => {
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({}));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(setCronHour).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("CA-2: a File value for hour is an invalid request", async () => {
    const fd = new FormData();
    fd.set("hour", new Blob(["7"]), "hour.txt");
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, fd);
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(setCronHour).not.toHaveBeenCalled();
  });

  it("CA-3: an invalid_hour result never revalidates", async () => {
    setCronHour.mockResolvedValue({ ok: false, error: "invalid_hour" });
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({ hour: "99" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidHour" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("CA-4: a thrown secret-shaped error returns the generic error, never the message, never revalidates", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:secret@h/db");
    setCronHour.mockRejectedValue(new Error("connection refused: postgres://user:secret@db.example.com/etfs"));
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("connection refused");
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("CA-4b: the deps factory throwing gives the same generic error state", async () => {
    setCronHour.mockRejectedValue(new Error("MissingDatabaseUrlError"));
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
  });

  it("CA-5: no network call during the action", async () => {
    setCronHour.mockResolvedValue({ ok: true, hour: 7 });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { saveCronHourAction } = await import("./actions");
    await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
