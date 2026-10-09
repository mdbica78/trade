import { describe, expect, it } from "vitest";
import type { ChatReplyState } from "./chat-state";
import { appendTranscript } from "./transcript";

const REPLY: ChatReplyState = { tone: "success", messageKey: "removed", values: { symbol: "XYZ" } };

describe("appendTranscript", () => {
  it("appends with an incrementing id, preserving order", () => {
    let transcript = appendTranscript([], "first", REPLY);
    expect(transcript).toEqual([{ id: 0, message: "first", reply: REPLY }]);

    transcript = appendTranscript(transcript, "second", REPLY);
    expect(transcript.map((e) => e.id)).toEqual([0, 1]);
    expect(transcript.map((e) => e.message)).toEqual(["first", "second"]);
  });

  it("does not mutate the previous array", () => {
    const prev = appendTranscript([], "first", REPLY);
    const next = appendTranscript(prev, "second", REPLY);
    expect(prev).toHaveLength(1);
    expect(next).toHaveLength(2);
  });
});
