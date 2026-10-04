import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import { CHAT_INVALID_REASONS, CHAT_UNAVAILABLE_REASONS, type ChatActionResult, type ChatOutcome } from "@/lib/ai/chat";
import { PROVIDER_ERROR_CODES } from "@/lib/ai/providers/types";
import { UNCLEAR_REASONS } from "@/lib/ai/capabilities/configuration/intent";
import { EXECUTION_CODES, type ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import { chatOutcomeToReply, unavailableReplyKey } from "./reply-messages";

const FIELD = { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" };

function executedOutcome(code: ExecutionCode): ChatOutcome {
  const needsField = ["tracked", "already_tracked", "untracked", "not_tracked"].includes(code);
  const result: ChatActionResult = {
    index: 1,
    status: "done",
    capability: "configuration",
    action: code,
    symbol: "BTBETRETF",
    changed: false,
    configuration: {
      code,
      symbol: "BTBETRETF",
      field: needsField ? FIELD : null,
      adapterKey: code === "added" ? "brd-depositary" : null,
      detectionReason: code === "added_no_adapter" ? "no_match" : null,
      changed: false,
    },
    ...(needsField ? { field: FIELD } : {}),
  };
  return { kind: "executed_actions", results: [result] };
}

function allOutcomes(): ChatOutcome[] {
  const outcomes: ChatOutcome[] = [];
  for (const reason of CHAT_INVALID_REASONS) outcomes.push({ kind: "invalid_message", reason });
  for (const reason of CHAT_UNAVAILABLE_REASONS) outcomes.push({ kind: "unavailable", reason });
  for (const error of PROVIDER_ERROR_CODES) outcomes.push({ kind: "interpreted", outcome: { kind: "provider_error", error } });
  outcomes.push({ kind: "interpreted", outcome: { kind: "unsupported" } });
  outcomes.push({ kind: "interpreted", outcome: { kind: "too_many" } });
  outcomes.push({ kind: "invalid_action", index: 3, reason: "bad_slot" });
  outcomes.push({ kind: "key_request" });
  for (const reason of UNCLEAR_REASONS) {
    if (reason === "malformed" || reason === "model_unclear") {
      outcomes.push({ kind: "interpreted", outcome: { kind: "unclear", reason } });
    } else {
      outcomes.push({ kind: "invalid_action", index: 1, reason });
    }
  }
  for (const code of EXECUTION_CODES) outcomes.push(executedOutcome(code));
  outcomes.push({
    kind: "executed_actions",
    results: [
      { index: 1, status: "done", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: true,
        widget: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 } },
      { index: 2, status: "failed", capability: "widgets", action: "widget_update", symbol: "BTBETRETF", changed: false },
      { index: 3, status: "not_run", capability: "configuration", action: "track_field", symbol: "BTBETRETF", changed: false },
    ],
  });
  outcomes.push({ kind: "error" });
  return outcomes;
}

describe("chatOutcomeToReply covers the whole outcome union with translated templates", () => {
  const outcomes = allOutcomes();

  it("CRM-0: covers a non-trivial number of outcomes (not a vacuous pass)", () => {
    expect(outcomes.length).toBeGreaterThan(20);
  });

  it.each(outcomes)("CRM-1: %o maps to a key present and renderable in both catalogues", (outcome) => {
    const reply = chatOutcomeToReply(outcome);
    expect(reply.messageKey in en.Chat.replies).toBe(true);
    expect(reply.messageKey in ro.Chat.replies).toBe(true);
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const t = createTranslator({ locale, messages, onError: () => {} });
      const values = {
        ...reply.values,
        ...(reply.field !== undefined ? { field: reply.field[locale] } : {}),
      };
      const text = t(`Chat.replies.${reply.messageKey}`, values);
      expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(text.length).toBeGreaterThan(0);
      for (const action of reply.actions ?? []) {
        const actionValues = {
          ...action.values,
          ...(action.field !== undefined ? { field: action.field[locale] } : {}),
        };
        expect(t(`Chat.replies.${action.messageKey}`, actionValues)).not.toMatch(/\{[a-zA-Z]+\}/);
        expect(t(`Chat.replies.actionStatus.${action.status}`)).toBeTruthy();
      }
    }
  });

  it("CRM-2: invalid actions use a fixed indexed reply without model details", () => {
    const reply = chatOutcomeToReply({ kind: "invalid_action", index: 4, reason: "unknown_field" });
    expect(reply).toMatchObject({ messageKey: "invalidAction", values: { index: 4 } });
    expect(JSON.stringify(reply)).not.toContain("unknown_field");
  });

  it("preserves a single configuration failure's specific translated reply instead of claiming completion", () => {
    const previous = executedOutcome("not_tracked");
    if (previous.kind !== "executed_actions") throw new Error("unexpected fixture");
    const result = { ...previous.results[0], status: "failed" as const };
    expect(chatOutcomeToReply({ kind: "executed_actions", results: [result] })).toMatchObject({
      tone: "info", messageKey: "notTracked",
    });
    expect(chatOutcomeToReply({
      kind: "executed_actions",
      results: [result, { index: 2, status: "not_run", capability: "widgets",
        action: "widget_add", symbol: "BTBETRETF", changed: false }],
    })).toMatchObject({
      tone: "error", messageKey: "actionsPartial",
      actions: [{ status: "failed", messageKey: "notTracked" }, { status: "not_run" }],
    });
  });

  it("CRM-3: every reply key has the same placeholders in Romanian and English", () => {
    const placeholdersOf = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en.Chat.replies) as (keyof typeof en.Chat.replies)[]) {
      if (key === "actionStatus") continue;
      expect(placeholdersOf(ro.Chat.replies[key])).toEqual(placeholdersOf(en.Chat.replies[key]));
    }
    for (const status of Object.keys(en.Chat.replies.actionStatus) as (keyof typeof en.Chat.replies.actionStatus)[]) {
      expect(placeholdersOf(ro.Chat.replies.actionStatus[status]))
        .toEqual(placeholdersOf(en.Chat.replies.actionStatus[status]));
    }
  });

  it("CRM-4: unavailable replies carry their admin link", () => {
    for (const reason of CHAT_UNAVAILABLE_REASONS) {
      const reply = chatOutcomeToReply({ kind: "unavailable", reason });
      expect(reply.messageKey).toBe(unavailableReplyKey(reason));
      expect(reply.adminLink).toBe(true);
    }
  });

  it("CRM-5: provider model errors carry adminLink; other provider failures do not", () => {
    const modelNotFound = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "model_not_found" } });
    expect(modelNotFound).toMatchObject({ messageKey: "providerModelNotFound", adminLink: true });
    const authFailed = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "auth_failed" } });
    expect(authFailed.messageKey).toBe("providerAuthFailed");
    const badResponse = chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error: "bad_response" } });
    expect(badResponse.messageKey).toBe("providerBadResponse");
  });

  it("US-045: failed action lists identify each action with a localized completion status", () => {
    const reply = chatOutcomeToReply(outcomes.find((outcome) => outcome.kind === "executed_actions" && outcome.results.length === 3)!);
    expect(reply.messageKey).toBe("actionsPartial");
    expect(reply.actions?.map((action) => action.status)).toEqual(["done", "failed", "not_run"]);
  });

  it("US-042: key request always gives a fixed key-free admin link reply", () => {
    const reply = chatOutcomeToReply({ kind: "key_request" });
    expect(reply).toEqual({ tone: "info", messageKey: "keyRequest", adminLink: true });
    expect(reply.values).toBeUndefined();
  });
});
