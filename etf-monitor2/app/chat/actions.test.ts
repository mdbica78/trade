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
    handleChatMessageMock.mockResolvedValue({ kind: "interpreted", outcome: { kind: "unsupported" } });
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
      kind: "executed_actions",
      results: [{
        index: 1, status: "done", capability: "configuration", action: "add_etf", symbol: "XYZ", changed: true,
        configuration: { code: "added", symbol: "XYZ", field: null, adapterKey: "brd-depositary", detectionReason: null, changed: true },
      }],
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
      kind: "executed_actions",
      results: [{
        index: 1, status: "done", capability: "configuration", action: "add_etf", symbol: "XYZ", changed: false,
        configuration: { code: "already_monitored", symbol: "XYZ", field: null, adapterKey: null, detectionReason: null, changed: false },
      }],
    });
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");
    await sendChatMessageAction(formData);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("revalidates every distinct changed ETF and only the detail page for widget actions", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({
      kind: "executed_actions",
      results: [
        { index: 1, status: "done", capability: "widgets", action: "widget_add", symbol: "XYZ", changed: true },
        { index: 2, status: "done", capability: "configuration", action: "track_field", symbol: "XYZ", changed: true },
        { index: 3, status: "done", capability: "widgets", action: "widget_update", symbol: "ABC", changed: true },
      ],
    });
    const formData = new FormData();
    formData.set("message", "update some settings");
    await sendChatMessageAction(formData);
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual([
      "/etf/XYZ",
      "/",
      "/admin/etfs",
      "/admin/etfs/XYZ/fields",
      "/etf/ABC",
    ]);
  });

  it("AT-E1: an expanded widget outcome revalidates each changed per-ETF result, not the matched:0 one", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({
      kind: "executed_actions",
      results: [
        { index: 1, status: "done", capability: "widgets", action: "widget_clear", symbol: "BTBETRETF", changed: true, widget: { action: "widget_clear", symbol: "BTBETRETF", changed: true, slot: 2, matched: 1 } },
        { index: 1, status: "done", capability: "widgets", action: "widget_clear", symbol: "PTENGETF", changed: false, widget: { action: "widget_clear", symbol: "PTENGETF", changed: false, slot: null, matched: 0 } },
        { index: 1, status: "done", capability: "widgets", action: "widget_clear", symbol: "TVBETETF", changed: true, widget: { action: "widget_clear", symbol: "TVBETETF", changed: true, slot: 2, matched: 1 } },
      ],
    });
    const formData = new FormData();
    formData.set("message", "clear max value for all etf");
    await sendChatMessageAction(formData);
    const paths = revalidatePathMock.mock.calls.map(([path]) => path);
    expect(paths).toContain("/etf/BTBETRETF");
    expect(paths).toContain("/etf/TVBETETF");
    expect(paths).not.toContain("/etf/PTENGETF");
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
