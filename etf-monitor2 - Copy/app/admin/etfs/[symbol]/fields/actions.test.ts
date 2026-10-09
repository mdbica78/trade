import { beforeEach, describe, expect, it, vi } from "vitest";

const trackField = vi.fn();
const untrackField = vi.fn();
const moveField = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createEtfConfigDeps: () => ({}) }));
vi.mock("@/lib/config/tracked-fields", () => ({
  trackField: (...args: unknown[]) => trackField(...args),
  untrackField: (...args: unknown[]) => untrackField(...args),
  moveField: (...args: unknown[]) => moveField(...args),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trackFieldAction (FA-1, FA-5, FA-6)", () => {
  it("calls trackField with exactly {symbol, fieldKey}, ignoring extra fields", async () => {
    trackField.mockResolvedValue({ ok: true, action: "tracked", symbol: "X" });
    const { trackFieldAction } = await import("./actions");
    await trackFieldAction(
      { status: "idle" },
      formData({ symbol: "X", fieldKey: "nav_per_unit", display_order: "9", etf_id: "1", adapterKey: "other" }),
    );
    expect(trackField).toHaveBeenCalledWith({ symbol: "X", fieldKey: "nav_per_unit" }, {});
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/etf/X");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/etfs/X/fields");
  });

  it("invalid request (missing fieldKey) never calls trackField or revalidatePath", async () => {
    const { trackFieldAction } = await import("./actions");
    const state = await trackFieldAction({ status: "idle" }, formData({ symbol: "X" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(trackField).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a thrown error (secret-shaped) returns the generic error, never the message, never revalidates", async () => {
    trackField.mockRejectedValue(new Error("connection refused: postgres://user:secret@db.example.com/etfs"));
    const { trackFieldAction } = await import("./actions");
    const state = await trackFieldAction({ status: "idle" }, formData({ symbol: "X", fieldKey: "nav_per_unit" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("connection refused");
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a not-ok result never revalidates", async () => {
    trackField.mockResolvedValue({ ok: false, error: "field_not_available" });
    const { trackFieldAction } = await import("./actions");
    await trackFieldAction({ status: "idle" }, formData({ symbol: "X", fieldKey: "nope" }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("untrackFieldAction (FA-2)", () => {
  it("calls untrackField with exactly {symbol, fieldKey}", async () => {
    untrackField.mockResolvedValue({ ok: true, symbol: "X" });
    const { untrackFieldAction } = await import("./actions");
    await untrackFieldAction({ status: "idle" }, formData({ symbol: "X", fieldKey: "nav_per_unit" }));
    expect(untrackField).toHaveBeenCalledWith({ symbol: "X", fieldKey: "nav_per_unit" }, {});
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("invalid request never calls untrackField", async () => {
    const { untrackFieldAction } = await import("./actions");
    const state = await untrackFieldAction({ status: "idle" }, formData({ symbol: "X" }));
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(untrackField).not.toHaveBeenCalled();
  });

  it("getDb throwing gives the generic error state (FA-4)", async () => {
    untrackField.mockRejectedValue(new Error("boom"));
    const { untrackFieldAction } = await import("./actions");
    const state = await untrackFieldAction({ status: "idle" }, formData({ symbol: "X", fieldKey: "nav_per_unit" }));
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
  });
});

describe("moveFieldAction (FA-3)", () => {
  it("calls moveField with exactly {symbol, fieldKey, direction}", async () => {
    moveField.mockResolvedValue({ ok: true, moved: true, symbol: "X" });
    const { moveFieldAction } = await import("./actions");
    await moveFieldAction({ status: "idle" }, formData({ symbol: "X", fieldKey: "nav_per_unit", direction: "up" }));
    expect(moveField).toHaveBeenCalledWith({ symbol: "X", fieldKey: "nav_per_unit", direction: "up" }, {});
  });

  it("a direction other than up/down is an invalid request, moveField not called", async () => {
    const { moveFieldAction } = await import("./actions");
    const state = await moveFieldAction(
      { status: "idle" },
      formData({ symbol: "X", fieldKey: "nav_per_unit", direction: "sideways" }),
    );
    expect(state).toEqual({ status: "error", messageKey: "invalidRequest" });
    expect(moveField).not.toHaveBeenCalled();
  });
});
