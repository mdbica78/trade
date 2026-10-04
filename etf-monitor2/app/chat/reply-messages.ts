import { CHAT_MESSAGE_MAX_LENGTH, type ChatActionResult, type ChatOutcome, type ChatUnavailableReason } from "@/lib/ai/chat";
import type { ProviderErrorCode } from "@/lib/ai/providers/types";
import type { ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import type { UnclearReason } from "@/lib/ai/capabilities/configuration/intent";
import type { ChatActionReplyState, ChatReplyKey, ChatReplyState } from "@/components/chat/chat-state";

export const GENERIC_ERROR_REPLY: ChatReplyState = { tone: "error", messageKey: "genericError" };

const UNAVAILABLE_KEYS: Record<ChatUnavailableReason, ChatReplyKey> = {
  not_configured: "unavailableNotConfigured",
  unknown_provider: "unavailableUnknownProvider",
  not_implemented: "unavailableNotImplemented",
  no_api_key: "unavailableNoApiKey",
  no_model: "unavailableNoModel",
};

const PROVIDER_ERROR_KEYS: Record<ProviderErrorCode, ChatReplyKey> = {
  timeout: "providerTimeout",
  network: "providerNetwork",
  auth_failed: "providerAuthFailed",
  rate_limited: "providerRateLimited",
  model_not_found: "providerModelNotFound",
  provider_error: "providerError",
  bad_response: "providerBadResponse",
};

const UNCLEAR_KEYS: Record<UnclearReason, ChatReplyKey> = {
  malformed: "notUnderstood",
  model_unclear: "modelUnclear",
  symbol_not_in_message: "symbolNotInMessage",
  unknown_etf: "etfNotFound",
  unknown_field: "fieldNotAvailable",
  already_tracked: "alreadyTracked",
  not_tracked: "notTracked",
};

const EXECUTED_KEYS: Record<ExecutionCode, ChatReplyKey> = {
  added: "added",
  added_no_adapter: "addedNoAdapter",
  reactivated: "reactivated",
  already_monitored: "alreadyMonitored",
  add_rejected: "notUnderstood",
  removed: "removed",
  already_inactive: "alreadyInactive",
  not_found: "etfNotFound",
  tracked: "tracked",
  already_tracked: "alreadyTracked",
  field_not_available: "fieldNotAvailable",
  untracked: "untracked",
  not_tracked: "notTracked",
};

const WIDGET_KEYS: Record<string, ChatReplyKey> = {
  widget_add: "widgetAdded",
  widget_update: "widgetUpdated",
  widget_clear: "widgetCleared",
  widget_replace: "widgetReplaced",
};

export function unavailableReplyKey(reason: ChatUnavailableReason): ChatReplyKey {
  return UNAVAILABLE_KEYS[reason];
}

function actionReply(result: ChatActionResult): ChatActionReplyState {
  if (result.status === "failed" && result.configuration === undefined) {
    return { index: result.index, status: result.status, messageKey: "actionFailed", values: { symbol: result.symbol } };
  }
  if (result.status === "not_run") {
    return { index: result.index, status: result.status, messageKey: "actionNotRun", values: { symbol: result.symbol } };
  }
  if (result.configuration !== undefined) {
    const outcome = result.configuration;
    return {
      status: result.status,
      index: result.index,
      messageKey: EXECUTED_KEYS[outcome.code],
      values: { symbol: outcome.symbol, adapter: outcome.adapterKey ?? undefined },
      ...(result.field === undefined ? {} : { field: { ro: result.field.labelRo, en: result.field.labelEn } }),
      ...(outcome.detectionReason === null ? {} : { detectionReason: outcome.detectionReason }),
    };
  }
  return {
    status: result.status,
    index: result.index,
    messageKey: WIDGET_KEYS[result.action] ?? "actionFailed",
    values: {
      symbol: result.symbol,
      ...(result.widget?.slot === null || result.widget?.slot === undefined ? {} : { slot: result.widget.slot }),
    },
  };
}

export function chatOutcomeToReply(outcome: ChatOutcome): ChatReplyState {
  switch (outcome.kind) {
    case "key_request":
      return { tone: "info", messageKey: "keyRequest", adminLink: true };
    case "invalid_message":
      if (outcome.reason === "empty") return { tone: "error", messageKey: "emptyMessage" };
      return { tone: "error", messageKey: "tooLong", values: { max: CHAT_MESSAGE_MAX_LENGTH } };
    case "unavailable":
      return { tone: "info", messageKey: unavailableReplyKey(outcome.reason), adminLink: true };
    case "interpreted": {
      const interpreted = outcome.outcome;
      if (interpreted.kind === "unsupported") return { tone: "info", messageKey: "unsupported" };
      if (interpreted.kind === "too_many") return { tone: "info", messageKey: "tooManyActions" };
      if (interpreted.kind === "provider_error") {
        const key = PROVIDER_ERROR_KEYS[interpreted.error];
        return { tone: "error", messageKey: key, adminLink: key === "providerModelNotFound" ? true : undefined };
      }
      return { tone: "info", messageKey: UNCLEAR_KEYS[interpreted.reason] };
    }
    case "invalid_action":
      return { tone: "info", messageKey: "invalidAction", values: { index: outcome.index } };
    case "executed_actions": {
      const actionResults = outcome.results.map(actionReply);
      if (actionResults.length === 1 && (actionResults[0]?.status === "done" ||
          outcome.results[0]?.configuration !== undefined)) {
        const item = actionResults[0];
        const result = outcome.results[0];
        const isSuccess = result?.capability === "widgets" ||
          ["added", "added_no_adapter", "reactivated", "removed", "tracked", "untracked"].includes(result?.configuration?.code ?? "");
        return {
          tone: isSuccess ? "success" : "info",
          messageKey: item.messageKey,
          values: item.values,
          field: item.field,
          detectionReason: item.detectionReason,
        };
      }
      const complete = outcome.results.every((result) => result.status === "done");
      return {
        tone: complete ? "success" : "error",
        messageKey: complete ? "actionsComplete" : "actionsPartial",
        actions: actionResults,
      };
    }
    case "error":
      return GENERIC_ERROR_REPLY;
  }
}

export function changedActions(outcome: ChatOutcome): readonly ChatActionResult[] {
  if (outcome.kind !== "executed_actions") return [];
  return outcome.results.filter((result) => result.changed && result.status === "done");
}
