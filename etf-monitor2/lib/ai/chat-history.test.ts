import { describe, expect, it } from "vitest";
import {
  HISTORY_MESSAGES,
  HISTORY_MESSAGE_MAX_CHARS,
  HISTORY_OLDEST_MIN_CHARS,
  HISTORY_RAW_MAX_CHARS,
  HISTORY_TOTAL_MAX_CHARS,
  historyGroundingText,
  historyMemo,
  middleCut,
  prepareHistory,
} from "./chat-history";
import type { GenerateMessage } from "./providers/types";
import type { ChatOutcome } from "./chat";

function turn(role: "user" | "assistant", content: string): GenerateMessage {
  return { role, content };
}

describe("prepareHistory (HI)", () => {
  it("HI-1: 22 messages -> the window keeps the last 21, oldest dropped", () => {
    const raw = Array.from({ length: 22 }, (_, i) => turn(i % 2 === 0 ? "user" : "assistant", `m${i}`));
    const result = prepareHistory(JSON.stringify(raw));
    expect(result).toHaveLength(21);
    expect(result[0]!.content).toBe("m1");
    expect(result.at(-1)!.content).toBe("m21");
  });

  it("HI-2: 23 messages -> still exactly 21, the two oldest dropped", () => {
    const raw = Array.from({ length: 23 }, (_, i) => turn("user", `m${i}`));
    const result = prepareHistory(JSON.stringify(raw));
    expect(result).toHaveLength(21);
    expect(result[0]!.content).toBe("m2");
  });

  it("HI-3: a 1000-char message is cut to exactly 400 chars, keeping head and tail", () => {
    const long = "A".repeat(500) + "B".repeat(500);
    const result = prepareHistory(JSON.stringify([turn("user", long)]));
    expect(result[0]!.content).toHaveLength(HISTORY_MESSAGE_MAX_CHARS);
    expect(result[0]!.content.startsWith("A")).toBe(true);
    expect(result[0]!.content.endsWith("B")).toBe(true);
    expect(result[0]!.content).toContain("…");
  });

  it("HI-4: 21 messages of 400 chars shrink the oldest ones until the total is <= 6000, count unchanged", () => {
    const raw = Array.from({ length: HISTORY_MESSAGES }, (_, i) => turn("user", "x".repeat(HISTORY_MESSAGE_MAX_CHARS)));
    const result = prepareHistory(JSON.stringify(raw));
    expect(result).toHaveLength(HISTORY_MESSAGES);
    const total = result.reduce((sum, m) => sum + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(HISTORY_TOTAL_MAX_CHARS);
    // every shrunk message hits at least the oldest-min floor
    for (const m of result) {
      expect(m.content.length).toBeGreaterThanOrEqual(HISTORY_OLDEST_MIN_CHARS);
    }
  });

  it("HI-5: malformed, non-array, oversized, bad-role or empty-content input never throws", () => {
    expect(prepareHistory("not json")).toEqual([]);
    expect(prepareHistory(JSON.stringify({ not: "an array" }))).toEqual([]);
    expect(prepareHistory("x".repeat(HISTORY_RAW_MAX_CHARS + 1))).toEqual([]);
    expect(prepareHistory(42)).toEqual([]);
    expect(prepareHistory(undefined)).toEqual([]);
    expect(prepareHistory(null)).toEqual([]);
    const mixed = [
      { role: "user", content: "ok" },
      { role: "system", content: "bad role" },
      { role: "user", content: "" },
      { role: "user", content: "   " },
      { role: "assistant" },
      null,
      "not an object",
    ];
    expect(prepareHistory(JSON.stringify(mixed))).toEqual([{ role: "user", content: "ok" }]);
  });

  it("HI-6: historyGroundingText joins only the user turns", () => {
    const history = [turn("user", "add XYZ"), turn("assistant", "[done: add_etf — XYZ]"), turn("user", "and 30 days too")];
    expect(historyGroundingText(history)).toBe("add XYZ\nand 30 days too");
  });
});

describe("historyMemo (HI-7)", () => {
  it("key_request", () => {
    expect(historyMemo({ kind: "key_request" })).toBe("[key request refused]");
  });

  it("invalid_message / unavailable", () => {
    expect(historyMemo({ kind: "invalid_message", reason: "too_long" })).toBe("[nothing done: invalid_message]");
    expect(historyMemo({ kind: "unavailable", reason: "no_api_key" })).toBe("[nothing done: unavailable]");
  });

  it("answered: reply and/or question joined", () => {
    expect(historyMemo({ kind: "answered", reply: "I'll do it.", question: null })).toBe("I'll do it.");
    expect(historyMemo({ kind: "answered", reply: null, question: "Which one?" })).toBe("Which one?");
    expect(historyMemo({ kind: "answered", reply: "ok", question: "really?" })).toBe("ok\n\nreally?");
  });

  it("interpreted: provider_error keeps the error code, others are closed", () => {
    expect(historyMemo({ kind: "interpreted", outcome: { kind: "provider_error", error: "timeout" } })).toBe(
      "[nothing done: provider_error timeout]",
    );
    expect(historyMemo({ kind: "interpreted", outcome: { kind: "unsupported" } })).toBe("[nothing done: unsupported]");
    expect(historyMemo({ kind: "interpreted", outcome: { kind: "too_many" } })).toBe("[nothing done: too_many]");
    expect(historyMemo({ kind: "interpreted", outcome: { kind: "unclear", reason: "malformed" } })).toBe(
      "[nothing done: unclear]",
    );
  });

  it("invalid_action: closed values only, with optional symbol", () => {
    expect(historyMemo({ kind: "invalid_action", index: 2, reason: "unknown_field" })).toBe(
      "[nothing done: action 2 unknown_field]",
    );
    expect(historyMemo({ kind: "invalid_action", index: 1, reason: "etf_inactive", symbol: "PTENGETF" })).toBe(
      "[nothing done: action 1 etf_inactive PTENGETF]",
    );
  });

  it("executed_actions: one bracketed status line per result, optional reply prefix", () => {
    const outcome: ChatOutcome = {
      kind: "executed_actions",
      results: [
        { index: 1, status: "done", capability: "configuration", action: "add_etf", symbol: "XYZ", changed: true },
        { index: 2, status: "failed", capability: "widgets", action: "widget_add", symbol: "XYZ", changed: false },
      ],
    };
    expect(historyMemo(outcome)).toBe("[done: add_etf — XYZ; failed: widget_add — XYZ]");
    expect(historyMemo({ ...outcome, reply: "Adding it." })).toBe(
      "Adding it.\n\n[done: add_etf — XYZ; failed: widget_add — XYZ]",
    );
  });

  it("error", () => {
    expect(historyMemo({ kind: "error" })).toBe("[nothing done: error]");
  });

  it("never contains an exception sentinel even if one somehow reached a field", () => {
    const memo = historyMemo({ kind: "invalid_action", index: 1, reason: "malformed" });
    expect(memo).not.toContain("Error");
    expect(memo).not.toContain("at ");
  });
});

describe("middleCut", () => {
  it("returns text unchanged when within the limit", () => {
    expect(middleCut("short", 10)).toBe("short");
  });

  it("cuts exactly to the requested length, keeping head and tail", () => {
    const text = "A".repeat(50) + "B".repeat(50);
    const cut = middleCut(text, 21);
    expect(cut).toHaveLength(21);
    expect(cut.startsWith("A")).toBe(true);
    expect(cut.endsWith("B")).toBe(true);
    expect(cut).toContain("…");
  });
});
