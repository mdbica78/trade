import { describe, expect, it, vi } from "vitest";
import { chatTurn, historyFromTranscript, NEW_CONVERSATION_INTENT } from "./transcript";
import type { ChatReplyState, TranscriptEntry } from "./chat-state";

function entry(id: number, message: string, memo?: string): TranscriptEntry {
  const reply: ChatReplyState = { tone: "success", messageKey: "added", ...(memo === undefined ? {} : { memo }) };
  return { id, message, reply };
}

describe("historyFromTranscript (TH)", () => {
  it("TH-1: user text as shown, assistant turn from the reply's memo when present", () => {
    const entries = [entry(0, "add XYZ", "[done: add_etf — XYZ]"), entry(1, "and track net_asset too")];
    expect(historyFromTranscript(entries)).toEqual([
      { role: "user", content: "add XYZ" },
      { role: "assistant", content: "[done: add_etf — XYZ]" },
      { role: "user", content: "and track net_asset too" },
    ]);
  });

  it("TH-2: an entry with no memo (or an empty one) contributes only its user turn", () => {
    const entries = [entry(0, "hello", ""), entry(1, "again")];
    expect(historyFromTranscript(entries)).toEqual([
      { role: "user", content: "hello" },
      { role: "user", content: "again" },
    ]);
  });

  it("TH-3: max slices to the last N history messages", () => {
    const entries = [entry(0, "one", "m1"), entry(1, "two", "m2"), entry(2, "three", "m3")];
    const all = historyFromTranscript(entries);
    expect(all).toHaveLength(6);
    expect(historyFromTranscript(entries, 2)).toEqual(all.slice(-2));
  });

  it("TH-4: no entries -> empty history", () => {
    expect(historyFromTranscript([])).toEqual([]);
  });
});

describe("chatTurn 'New conversation' intent (US-055 AC4)", () => {
  it("intent=new resets to an empty transcript without calling the server action", async () => {
    const action = vi.fn();
    const formData = new FormData();
    formData.set("intent", NEW_CONVERSATION_INTENT);
    const prev = [entry(0, "something", "m")];
    const result = await chatTurn(prev, formData, action, "hidden");
    expect(result).toEqual([]);
    expect(action).not.toHaveBeenCalled();
  });

  it("an ordinary submit sends the history built from the previous transcript and appends the new turn", async () => {
    const reply: ChatReplyState = { tone: "success", messageKey: "added", memo: "[done: add_etf — XYZ]" };
    const action = vi.fn(async (fd: FormData) => {
      expect(JSON.parse(String(fd.get("history")))).toEqual([{ role: "user", content: "first" }]);
      return reply;
    });
    const prev = [entry(0, "first")];
    const formData = new FormData();
    formData.set("message", "second");
    const result = await chatTurn(prev, formData, action, "hidden");
    expect(action).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ id: 1, message: "second", reply });
  });

  it("the next turn after a 'New conversation' sends an empty history", async () => {
    const action = vi.fn(async (fd: FormData) => {
      expect(JSON.parse(String(fd.get("history")))).toEqual([]);
      return { tone: "success" as const, messageKey: "added" as const };
    });
    const newForm = new FormData();
    newForm.set("intent", NEW_CONVERSATION_INTENT);
    const afterNew = await chatTurn([entry(0, "first", "m")], newForm, action, "hidden");
    expect(afterNew).toEqual([]);

    const nextForm = new FormData();
    nextForm.set("message", "and for 30 days too");
    await chatTurn(afterNew, nextForm, action, "hidden");
    expect(action).toHaveBeenCalledOnce();
  });
});
