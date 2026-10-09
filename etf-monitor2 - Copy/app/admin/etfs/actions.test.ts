import { beforeEach, describe, expect, it, vi } from "vitest";

const addEtf = vi.fn();
const setEtfActive = vi.fn();
const setEtfAdapter = vi.fn();
const detectEtfAdapter = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createEtfConfigDeps: () => ({}) }));
vi.mock("@/lib/config/etfs", () => ({
  addEtf: (...args: unknown[]) => addEtf(...args),
  setEtfActive: (...args: unknown[]) => setEtfActive(...args),
  setEtfAdapter: (...args: unknown[]) => setEtfAdapter(...args),
  detectEtfAdapter: (...args: unknown[]) => detectEtfAdapter(...args),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addEtfAction (AR-6, AC9)", () => {
  it("calls addEtf with exactly {symbol, name} even when the form carries extra fields", async () => {
    addEtf.mockResolvedValue({ ok: true, action: "added", symbol: "BTBETRETF", adapterKey: null, reason: "no_match" });
    const { addEtfAction } = await import("./actions");
    await addEtfAction(
      { status: "idle" },
      formData({ symbol: "btbetretf", name: "BT Index", bvb_url: "x", adapter_key: "y", is_active: "true" }),
    );
    expect(addEtf).toHaveBeenCalledWith({ symbol: "btbetretf", name: "BT Index" }, {});
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/etfs");
  });

  it("invalid request (missing field) never calls addEtf or revalidatePath", async () => {
    const { addEtfAction } = await import("./actions");
    const state = await addEtfAction({ status: "idle" }, formData({ symbol: "X" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(addEtf).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC9: a thrown error (with a secret-shaped message) returns the generic error, never the message, never revalidates", async () => {
    addEtf.mockRejectedValue(new Error("connection refused: postgres://user:secret@db.example.com/etfs"));
    const { addEtfAction } = await import("./actions");
    const state = await addEtfAction({ status: "idle" }, formData({ symbol: "X", name: "Y" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("connection refused");
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setEtfActiveAction", () => {
  it("calls setEtfActive with exactly {symbol, active}", async () => {
    setEtfActive.mockResolvedValue({ ok: true });
    const { setEtfActiveAction } = await import("./actions");
    await setEtfActiveAction({ status: "idle" }, formData({ symbol: "X", active: "false", name: "ignored" }));
    expect(setEtfActive).toHaveBeenCalledWith({ symbol: "X", active: false }, {});
  });

  it("rejects an active value that is not exactly true/false", async () => {
    const { setEtfActiveAction } = await import("./actions");
    const state = await setEtfActiveAction({ status: "idle" }, formData({ symbol: "X", active: "yes" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(setEtfActive).not.toHaveBeenCalled();
  });

  it("a thrown error returns the generic error", async () => {
    setEtfActive.mockRejectedValue(new Error("DATABASE_URL leaked"));
    const { setEtfActiveAction } = await import("./actions");
    const state = await setEtfActiveAction({ status: "idle" }, formData({ symbol: "X", active: "true" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
  });
});

describe("setEtfAdapterAction", () => {
  it("calls setEtfAdapter with adapterKey null when the form value is empty", async () => {
    setEtfAdapter.mockResolvedValue({ ok: true });
    const { setEtfAdapterAction } = await import("./actions");
    await setEtfAdapterAction({ status: "idle" }, formData({ symbol: "X", adapterKey: "" }));
    expect(setEtfAdapter).toHaveBeenCalledWith({ symbol: "X", adapterKey: null }, {});
  });

  it("calls setEtfAdapter with the given key", async () => {
    setEtfAdapter.mockResolvedValue({ ok: true });
    const { setEtfAdapterAction } = await import("./actions");
    await setEtfAdapterAction({ status: "idle" }, formData({ symbol: "X", adapterKey: "brd-depositary" }));
    expect(setEtfAdapter).toHaveBeenCalledWith({ symbol: "X", adapterKey: "brd-depositary" }, {});
  });
});

describe("redetectEtfAdapterAction", () => {
  it("calls detectEtfAdapter with exactly {symbol}", async () => {
    detectEtfAdapter.mockResolvedValue({ ok: true, adapterKey: "brd-depositary", reason: "detected" });
    const { redetectEtfAdapterAction } = await import("./actions");
    await redetectEtfAdapterAction({ status: "idle" }, formData({ symbol: "X", adapterKey: "ignored" }));
    expect(detectEtfAdapter).toHaveBeenCalledWith({ symbol: "X" }, {});
  });
});
