import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const handleChatMessageMock = vi.fn();
vi.mock("@/lib/ai/chat", () => ({ handleChatMessage: (...args: unknown[]) => handleChatMessageMock(...args) }));

afterEach(() => {
  handleChatMessageMock.mockClear();
});

describe("sendChatMessageAction history wiring (CAH, US-055 AC4)", () => {
  it("CAH-1: the form's history field is forwarded as options.history", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({ kind: "invalid_message", reason: "empty" });
    const formData = new FormData();
    formData.set("message", "hello");
    formData.set("history", JSON.stringify([{ role: "user", content: "earlier" }]));

    await sendChatMessageAction(formData);

    expect(handleChatMessageMock).toHaveBeenCalledTimes(1);
    const [raw, depsFactory, options] = handleChatMessageMock.mock.calls[0]!;
    expect(raw).toBe("hello");
    expect(depsFactory).toBeUndefined();
    expect(options).toEqual({ history: JSON.stringify([{ role: "user", content: "earlier" }]) });
  });

  it("CAH-2: the returned reply carries a memo built from the outcome", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({ kind: "key_request" });
    const formData = new FormData();
    formData.set("message", "set my key to X");

    const reply = await sendChatMessageAction(formData);

    expect(reply.memo).toBe("[key request refused]");
  });

  it("a missing history field still calls handleChatMessage with an empty options object value", async () => {
    const { sendChatMessageAction } = await import("./actions");
    handleChatMessageMock.mockResolvedValue({ kind: "invalid_message", reason: "empty" });
    const formData = new FormData();
    formData.set("message", "hello");

    await sendChatMessageAction(formData);

    const [, , options] = handleChatMessageMock.mock.calls[0]!;
    expect((options as { history: unknown }).history).toBeNull();
  });
});
