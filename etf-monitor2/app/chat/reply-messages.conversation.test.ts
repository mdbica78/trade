import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { ChatActionResult, ChatOutcome } from "@/lib/ai/chat";
import { buildChatReply, chatOutcomeToReply } from "./reply-messages";

describe("natural reply + result list (RC, US-055 AC2/AC3)", () => {
  it("RC-1: executed_actions with a model reply carries modelText and the grouped result list, always together", () => {
    const outcome: ChatOutcome = {
      kind: "executed_actions",
      reply: "Adaug maximul pentru BTBETRETF.",
      results: [
        {
          index: 1, status: "done", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: true,
          widget: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1, matched: 1 },
        },
      ],
    };
    const reply = chatOutcomeToReply(outcome);
    expect(reply.modelText).toBe("Adaug maximul pentru BTBETRETF.");
    expect(reply.actions).toBeDefined();
    expect(reply.actions).toHaveLength(1);
  });

  it("RC-2: invalid_action never carries a model reply; reason names the closed code", () => {
    const reply = chatOutcomeToReply({ kind: "invalid_action", index: 2, reason: "unknown_field" });
    expect(reply.modelText).toBeUndefined();
    expect(reply.reason).toEqual({ key: "unknownField", symbol: undefined, field: undefined });
  });

  it("RC-3: an execution failure keeps the reply, sets warning:true, and the list shows failed/not_run", () => {
    const outcome: ChatOutcome = {
      kind: "executed_actions",
      reply: "Fac ambele modificări.",
      results: [
        { index: 1, status: "failed", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: false },
        { index: 2, status: "not_run", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF", changed: false },
      ],
    };
    const reply = chatOutcomeToReply(outcome);
    expect(reply.modelText).toBe("Fac ambele modificări.");
    expect(reply.warning).toBe(true);
    expect(reply.actions?.map((a) => a.status)).toEqual(["failed", "not_run"]);
  });

  it("RC-4: buildChatReply attaches a memo derived from the outcome", () => {
    const reply = buildChatReply({ kind: "key_request" });
    expect(reply.memo).toBe("[key request refused]");
  });

  it("RC-5: a question-only outcome ('answered') carries modelText with no result list", () => {
    const reply = chatOutcomeToReply({ kind: "answered", reply: null, question: "Over how many days?" });
    expect(reply.modelText).toBe("Over how many days?");
    expect(reply.actions).toBeUndefined();
  });

  it("RC-6: Chat.reasons and Chat.what exist in both locales with matching placeholder parity", () => {
    for (const key of Object.keys(en.Chat.reasons)) {
      expect(key in ro.Chat.reasons, key).toBe(true);
    }
    for (const key of Object.keys(en.Chat.what)) {
      expect(key in ro.Chat.what, key).toBe(true);
    }
    const t = createTranslator({ locale: "en", messages: en, onError: () => {} });
    const tRo = createTranslator({ locale: "ro", messages: ro, onError: () => {} });
    expect(t("Chat.reasons.unknownField", { field: "x" })).toContain("x");
    expect(tRo("Chat.reasons.unknownField", { field: "x" })).toContain("x");
  });
});
