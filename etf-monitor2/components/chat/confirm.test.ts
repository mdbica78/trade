import { describe, expect, it } from "vitest";
import { isConfirmAnswer, pendingPlanToken } from "./confirm";
import type { TranscriptEntry } from "./chat-state";

function entry(status: "pending" | "confirmed" | "cancelled" | "discarded", token?: string): TranscriptEntry {
  return {
    id: 0,
    message: "remove PTENGETF",
    reply: { tone: "info", messageKey: "planProposed", plan: { status, ...(token === undefined ? {} : { token }) } },
  };
}

describe("typed plan confirmation", () => {
  it.each(["da", "DA!", " yes. ", "confirmă", "confirma", "ok", "go", "go ahead", "sigur"])(
    "recognizes the exact confirmation %s",
    (text) => expect(isConfirmAnswer(text)).toBe(true),
  );

  it.each(["nu", "no", "da, dar doar la X", "yes remove PTENGETF too", ""])(
    "does not treat a non-exact answer as confirmation: %s",
    (text) => expect(isConfirmAnswer(text)).toBe(false),
  );

  it("returns only a token on the final pending transcript entry", () => {
    expect(pendingPlanToken([entry("pending", "old"), entry("pending", "current")])).toBe("current");
    expect(pendingPlanToken([entry("confirmed", "old")])).toBeNull();
    expect(pendingPlanToken([entry("pending")])).toBeNull();
    expect(pendingPlanToken([])).toBeNull();
  });
});
