import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatTurn, historyFromTranscript } from "./transcript";
import type { ChatReplyState, TranscriptEntry } from "./chat-state";

const proposed: ChatReplyState = {
  tone: "info",
  messageKey: "planProposed",
  memo: "[proposed, waiting for confirmation: proposed: remove_etf — PTENGETF]",
  plan: { status: "pending", token: "opaque.plan.token" },
};
const initial: TranscriptEntry[] = [{ id: 0, message: "remove PTENGETF", reply: proposed }];
const actionReply: ChatReplyState = { tone: "success", messageKey: "removed" };
const confirm = {
  action: vi.fn(async (data: FormData) => {
    expect(data).toBeInstanceOf(FormData);
    return actionReply;
  }),
  confirmLabel: "Confirmă",
  cancelLabel: "Anulează",
};
const action = vi.fn(async (data: FormData) => {
  expect(data).toBeInstanceOf(FormData);
  return { tone: "info", messageKey: "unsupported" } as ChatReplyState;
});

beforeEach(() => {
  confirm.action.mockClear();
  action.mockClear();
});

describe("chat transcript plan decisions", () => {
  it("sends only the token for typed confirmation and drops it from the prior entry", async () => {
    const messageData = new FormData();
    messageData.set("message", "DA!");
    const next = await chatTurn(initial, messageData, action, "[key request]", 21, confirm);
    expect(confirm.action).toHaveBeenCalledTimes(1);
    const sent = confirm.action.mock.calls[0]?.[0];
    expect(sent?.get("token")).toBe("opaque.plan.token");
    const keys: string[] = [];
    sent?.forEach((_value, key) => keys.push(key));
    expect(keys).toEqual(["token"]);
    expect(action).not.toHaveBeenCalled();
    expect(next[0]?.reply.plan).toEqual({ status: "confirmed" });
    expect(next[1]?.message).toBe("DA!");
    expect(historyFromTranscript(next).some((m) => m.content.includes("opaque.plan.token"))).toBe(false);
  });

  it("cancels locally and discards a pending plan before sending a different message", async () => {
    const cancelData = new FormData();
    cancelData.set("intent", "cancel");
    const cancelled = await chatTurn(initial, cancelData, action, "[key request]", 21, confirm);
    expect(cancelled[0]?.reply.plan).toEqual({ status: "cancelled" });
    expect(confirm.action).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();

    const newData = new FormData();
    newData.set("message", "nu");
    const discarded = await chatTurn(initial, newData, action, "[key request]", 21, confirm);
    expect(discarded[0]?.reply.plan).toEqual({ status: "discarded" });
    expect(discarded[0]?.reply.memo).toContain("not confirmed");
    expect(action).toHaveBeenCalledTimes(1);
    const history = JSON.parse(String(action.mock.calls[0]?.[0].get("history"))) as { content: string }[];
    expect(history.some((m) => m.content.includes("opaque.plan.token"))).toBe(false);
    expect(action.mock.calls[0]?.[0].get("message")).toBe("nu");
  });
});
