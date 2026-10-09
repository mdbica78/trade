import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import { CHAT_INVALID_REASONS, CHAT_UNAVAILABLE_REASONS, type ChatOutcome } from "@/lib/ai/chat";
import { PROVIDER_ERROR_CODES } from "@/lib/ai/providers/types";
import { UNCLEAR_REASONS } from "@/lib/ai/capabilities/configuration/intent";
import { EXECUTION_CODES, type ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import { chatOutcomeToReply, unavailableReplyKey } from "./reply-messages";

const FIELD = { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" };

function executedOutcome(code: ExecutionCode): ChatOutcome {
  const needsField = ["tracked", "already_tracked", "untracked", "not_tracked"].includes(code);
  return {
    kind: "executed",
    result: {
      code,
      symbol: "BTBETRETF",
      field: needsField ? FIELD : null,
      adapterKey: code === "added" ? "brd-depositary" : null,
      detectionReason: code === "added_no_adapter" ? "no_match" : null,
      changed: false,
    },
  };
}

function allOutcomes(): ChatOutcome[] {
  const outcomes: ChatOutcome[] = [];
  for (const reason of CHAT_INVALID_REASONS) outcomes.push({ kind: "invalid_message", reason });
  for (const reason of CHAT_UNAVAILABLE_REASONS) outcomes.push({ kind: "unavailable", reason });
  for (const error of PROVIDER_ERROR_CODES) outcomes.push({ kind: "interpreted", outcome: { kind: "provider_error", error }, field: null });
  outcomes.push({ kind: "interpreted", outcome: { kind: "unsupported" }, field: null });
  outcomes.push({ kind: "interpreted", outcome: { kind: "multiple" }, field: null });
  for (const reason of UNCLEAR_REASONS) {
    const needsSymbolField = reason === "already_tracked" || reason === "not_tracked";
    outcomes.push({
      kind: "interpreted",
      outcome: needsSymbolField
        ? { kind: "unclear", reason, symbol: "BTBETRETF", field: "net_asset" }
        : { kind: "unclear", reason },
      field: needsSymbolField ? FIELD : null,
    });
  }
  for (const code of EXECUTION_CODES) outcomes.push(executedOutcome(code));
  outcomes.push({ kind: "error" });
  return outcomes;
}

describe("chatOutcomeToReply covers the whole outcome union with translated templates (CRM, AC4)", () => {
  const outcomes = allOutcomes();

  it("CRM-0: covers a non-trivial number of outcomes (not a vacuous pass)", () => {
    expect(outcomes.length).toBeGreaterThan(20);
  });

  it.each(outcomes)("CRM-1: %o maps to a key present and renderable in both catalogues", (outcome) => {
    const reply = chatOutcomeToReply(outcome);
    expect(reply.messageKey in en.Chat.replies).toBe(true);
    expect(reply.messageKey in ro.Chat.replies).toBe(true);

    for (const [locale, messages] of [
      ["en", en],
      ["ro", ro],
    ] as const) {
      const t = createTranslator({ locale, messages, onError: () => {} });
      const values = {
        ...reply.values,
        ...(reply.field !== undefined ? { field: reply.field[locale] } : {}),
      };
      const text = t(`Chat.replies.${reply.messageKey}`, values);
      expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("CRM-2: the four grounding/execution pairs share one reply key (tech-lead point 2)", () => {
    const pairs: [ChatOutcome, ChatOutcome][] = [
      [
        { kind: "interpreted", outcome: { kind: "unclear", reason: "unknown_etf" }, field: null },
        executedOutcome("not_found"),
      ],
      [
        { kind: "interpreted", outcome: { kind: "unclear", reason: "unknown_field" }, field: null },
        executedOutcome("field_not_available"),
      ],
      [
        { kind: "interpreted", outcome: { kind: "unclear", reason: "already_tracked", symbol: "BTBETRETF", field: "net_asset" }, field: FIELD },
        executedOutcome("already_tracked"),
      ],
      [
        { kind: "interpreted", outcome: { kind: "unclear", reason: "not_tracked", symbol: "BTBETRETF", field: "net_asset" }, field: FIELD },
        executedOutcome("not_tracked"),
      ],
    ];
    for (const [a, b] of pairs) {
      expect(chatOutcomeToReply(a).messageKey).toBe(chatOutcomeToReply(b).messageKey);
    }
  });

  it("CRM-3: every Chat.replies key has the same {placeholder} set in ro and en", () => {
    const placeholdersOf = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en.Chat.replies) as (keyof typeof en.Chat.replies)[]) {
      expect(placeholdersOf(ro.Chat.replies[key])).toEqual(placeholdersOf(en.Chat.replies[key]));
    }
  });

  it("CRM-4: unavailableReplyKey and the reply for the matching outcome give the same key, and adminLink is set", () => {
    for (const reason of CHAT_UNAVAILABLE_REASONS) {
      const reply = chatOutcomeToReply({ kind: "unavailable", reason });
      expect(reply.messageKey).toBe(unavailableReplyKey(reason));
      expect(reply.adminLink).toBe(true);
    }
  });

  it("CRM-5: model_not_found carries adminLink; auth_failed and bad_response do not force one", () => {
    const modelNotFound = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "model_not_found" }, field: null });
    expect(modelNotFound.messageKey).toBe("providerModelNotFound");
    expect(modelNotFound.adminLink).toBe(true);

    const authFailed = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "auth_failed" }, field: null });
    expect(authFailed.messageKey).toBe("providerAuthFailed");

    const badResponse = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "bad_response" }, field: null });
    expect(badResponse.messageKey).toBe("providerBadResponse");
  });
});
