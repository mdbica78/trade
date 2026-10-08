import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addCustomProvider = vi.fn();
const updateCustomProvider = vi.fn();
const deleteCustomProvider = vi.fn();
const revalidatePath = vi.fn();
const mockCreateCustomProviderConfigDeps = vi.fn(() => ({}));

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/custom-providers", () => ({
  addCustomProvider: (...args: unknown[]) => addCustomProvider(...args),
  updateCustomProvider: (...args: unknown[]) => updateCustomProvider(...args),
  deleteCustomProvider: (...args: unknown[]) => deleteCustomProvider(...args),
}));
vi.mock("@/lib/config/ai-keys", () => ({
  createCustomProviderConfigDeps: () => mockCreateCustomProviderConfigDeps(),
  saveProviderKey: vi.fn(),
  clearProviderKey: vi.fn(),
}));
vi.mock("@/lib/ai/settings-deps", () => ({
  createAiSettingsDeps: () => ({}),
  createProviderKeyConfigDeps: () => ({}),
}));
vi.mock("@/lib/config/ai-settings", () => ({ setAiSettings: vi.fn() }));
vi.mock("@/lib/ai/connection-test", () => ({ testProviderConnection: vi.fn() }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateCustomProviderConfigDeps.mockReturnValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("custom-provider admin actions (CPA)", () => {
  it("CPA-1: add passes exactly { name, baseUrl } and revalidates /admin/ai on ok", async () => {
    addCustomProvider.mockResolvedValue({ ok: true, id: "custom-1", keyRemoved: false });
    const { addCustomProviderAction } = await import("./actions");
    const state = await addCustomProviderAction(
      { status: "idle" },
      formData({ name: "Groq via custom", baseUrl: "https://api.groq.com/openai/v1", key: "ignored" }),
    );
    const call = addCustomProvider.mock.calls[0];
    expect(call?.[0]).toEqual({ name: "Groq via custom", baseUrl: "https://api.groq.com/openai/v1" });
    expect(state).toEqual({ status: "success", messageKey: "customProviderAdded" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ai");
  });

  it("CPA-2: update passes { id, name, baseUrl }; keyRemoved maps to customProviderUpdatedKeyRemoved", async () => {
    updateCustomProvider.mockResolvedValue({ ok: true, id: "custom-1", keyRemoved: true });
    const { updateCustomProviderAction } = await import("./actions");
    const state = await updateCustomProviderAction(
      { status: "idle" },
      formData({ id: "custom-1", name: "Groq", baseUrl: "https://api.groq.com/openai/v2" }),
    );
    expect(updateCustomProvider.mock.calls[0]?.[0]).toEqual({
      id: "custom-1",
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v2",
    });
    expect(state).toEqual({ status: "success", messageKey: "customProviderUpdatedKeyRemoved" });
  });

  it("CPA-3: delete passes the id only", async () => {
    deleteCustomProvider.mockResolvedValue({ ok: true, id: "custom-1", keyRemoved: true });
    const { deleteCustomProviderAction } = await import("./actions");
    await deleteCustomProviderAction({ status: "idle" }, formData({ id: "custom-1" }));
    expect(deleteCustomProvider.mock.calls[0]?.[0]).toBe("custom-1");
  });

  it("CPA-4: a missing field gives invalidRequest and builds no deps", async () => {
    const { addCustomProviderAction, updateCustomProviderAction, deleteCustomProviderAction } = await import("./actions");
    expect(await addCustomProviderAction({ status: "idle" }, formData({ name: "x" }))).toEqual({
      status: "error",
      messageKey: "invalidRequest",
    });
    expect(await updateCustomProviderAction({ status: "idle" }, formData({ id: "custom-1", name: "x" }))).toEqual({
      status: "error",
      messageKey: "invalidRequest",
    });
    expect(await deleteCustomProviderAction({ status: "idle" }, formData({}))).toEqual({
      status: "error",
      messageKey: "invalidRequest",
    });
    expect(mockCreateCustomProviderConfigDeps).not.toHaveBeenCalled();
    expect(addCustomProvider).not.toHaveBeenCalled();
    expect(updateCustomProvider).not.toHaveBeenCalled();
    expect(deleteCustomProvider).not.toHaveBeenCalled();
  });

  it("CPA-5: a rejection with a sentinel/postgres:// message gives genericError, sentinel absent", async () => {
    addCustomProvider.mockRejectedValue(new Error("connection refused: postgres://user:SENTINEL@db.example.com/etfs"));
    const { addCustomProviderAction } = await import("./actions");
    const state = await addCustomProviderAction(
      { status: "idle" },
      formData({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }),
    );
    expect(state).toEqual({ status: "error", messageKey: "genericError" });
    const json = JSON.stringify(state);
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("SENTINEL");
  });

  it("CPA-6: an extra key/apiKey form field is never forwarded", async () => {
    addCustomProvider.mockResolvedValue({ ok: true, id: "custom-1", keyRemoved: false });
    const { addCustomProviderAction } = await import("./actions");
    await addCustomProviderAction(
      { status: "idle" },
      formData({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1", key: "test-key-0000-leak", apiKey: "test-key-0001-leak" }),
    );
    const call = addCustomProvider.mock.calls[0]?.[0];
    expect(Object.keys(call).sort()).toEqual(["baseUrl", "name"]);
  });
});
