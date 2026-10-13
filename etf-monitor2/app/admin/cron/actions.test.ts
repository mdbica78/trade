import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setCronHour = vi.fn();
const getCronHour = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createDbDeps: () => ({}) }));
// cron-apply.ts (used, unmocked, by actions.ts) imports getCronHour/setCronHour from "./cron",
// which resolves to this same mocked module, so the real saveCronHourAndApply/requestRedeploy run.
vi.mock("@/lib/config/cron", () => ({
  setCronHour: (...args: unknown[]) => setCronHour(...args),
  getCronHour: (...args: unknown[]) => getCronHour(...args),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCronHour.mockResolvedValue(null);
  vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", "");
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

  const HOOK_URL = "https://hooks.example.test/deploy/prj_FAKE/HOOKSENTINEL";

  it("CA-6/CA-7: applying/not_configured, with the hook URL never reaching the state", async () => {
    getCronHour.mockResolvedValue(10);
    setCronHour.mockResolvedValue({ ok: true, hour: 7 });
    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    const { saveCronHourAction } = await import("./actions");
    const applying = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(applying).toEqual({ status: "success", messageKey: "cronSavedApplying" });
    expect(JSON.stringify(applying)).not.toContain(HOOK_URL);
    expect(JSON.stringify(applying)).not.toContain("HOOKSENTINEL");

    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", "");
    const notConfigured = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(notConfigured).toEqual({ status: "success", messageKey: "cronSavedNotConfigured" });
  });

  it("CA-8: the hook returning a failure status still reports the save, with cronSavedApplyFailed", async () => {
    getCronHour.mockResolvedValue(10);
    setCronHour.mockResolvedValue({ ok: true, hour: 7 });
    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(state).toEqual({ status: "success", messageKey: "cronSavedApplyFailed" });
    errSpy.mockRestore();
  });

  it("CA-9: setCronHour resolves before the deploy hook's fetch is called", async () => {
    getCronHour.mockResolvedValue(10);
    const order: string[] = [];
    setCronHour.mockImplementation(async () => {
      order.push("setCronHour");
      return { ok: true, hour: 7 };
    });
    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        order.push("fetch");
        return new Response(null, { status: 200 });
      }),
    );
    const { saveCronHourAction } = await import("./actions");
    await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(order).toEqual(["setCronHour", "fetch"]);
  });

  it("CA-10: the hook URL never appears anywhere in the returned state, whatever the outcome", async () => {
    getCronHour.mockResolvedValue(10);
    setCronHour.mockResolvedValue({ ok: true, hour: 7 });
    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`fetch failed: ${HOOK_URL}`);
      }),
    );
    const { saveCronHourAction } = await import("./actions");
    const state = await saveCronHourAction({ status: "idle" }, formData({ hour: "7" }));
    expect(JSON.stringify(state)).not.toContain(HOOK_URL);
    expect(JSON.stringify(state)).not.toContain("HOOKSENTINEL");
    errSpy.mockRestore();
  });
});
