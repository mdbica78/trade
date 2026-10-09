import { afterEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));

const handleChatMessageMock = vi.fn();
vi.mock("@/lib/ai/chat", () => ({ handleChatMessage: (raw: unknown) => handleChatMessageMock(raw) }));

afterEach(() => {
  revalidatePathMock.mockClear();
  handleChatMessageMock.mockClear();
});

describe("sendChatMessageAction (CA, AC8/AC2)", () => {
  it("CA-1: calls handleChatMessage exactly once with exactly the message field, ignoring other fields", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({ kind: "interpreted", outcome: { kind: "unsupported" }, field: null });
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");
    formData.set("symbol", "XYZ");
    formData.set("apiKey", "should-be-ignored");
    formData.set("GEMINI_API_KEY", "should-be-ignored");

    await sendChatMessageAction(formData);

    expect(handleChatMessageMock).toHaveBeenCalledTimes(1);
    expect(handleChatMessageMock).toHaveBeenCalledWith("add ETF XYZ");
  });

  it("CA-2: a missing message field or a File value is passed through as an empty string", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({ kind: "invalid_message", reason: "empty" });

    await sendChatMessageAction(new FormData());
    expect(handleChatMessageMock).toHaveBeenCalledWith("");

    handleChatMessageMock.mockClear();
    const withFile = new FormData();
    withFile.set("message", new File(["x"], "x.txt"));
    await sendChatMessageAction(withFile);
    expect(handleChatMessageMock).toHaveBeenCalledWith("");
  });

  it("revalidates every path only when the outcome changed something", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({
      kind: "executed",
      result: { code: "added", symbol: "XYZ", field: null, adapterKey: "brd-depositary", detectionReason: null, changed: true },
    });
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");
    await sendChatMessageAction(formData);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/etfs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/etfs/XYZ/fields");
    expect(revalidatePathMock).toHaveBeenCalledWith("/etf/XYZ");
  });

  it("does not revalidate when nothing changed", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({
      kind: "executed",
      result: { code: "already_monitored", symbol: "XYZ", field: null, adapterKey: null, detectionReason: null, changed: false },
    });
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");
    await sendChatMessageAction(formData);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("CA-4: handleChatMessage rejecting gives the generic error reply, no sentinel, no revalidation", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockRejectedValue(new Error("ZQ-EXC-1234 postgres://user:pw@host"));
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");
    const reply = await sendChatMessageAction(formData);
    expect(reply).toEqual({ tone: "error", messageKey: "genericError" });
    expect(JSON.stringify(reply)).not.toContain("ZQ-EXC");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
