import { CHAT_MESSAGE_MAX_LENGTH, type ChatActionResult, type ChatOutcome, type ChatUnavailableReason, type PlanRefusedReason } from "@/lib/ai/chat";
import { historyMemo } from "@/lib/ai/chat-history";
import { groupResults, type ActionDetail, type ResultGroup } from "@/lib/ai/chat-results";
import type { ProviderErrorCode } from "@/lib/ai/providers/types";
import type { ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import type { UnclearReason } from "@/lib/ai/capabilities/configuration/intent";
import type { ChatActionReplyState, ChatReasonKey, ChatReplyKey, ChatReplyState, WhatDescription } from "@/components/chat/chat-state";

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
  unsupported_format: "providerError",
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

/** US-058 req. 1: the "will do" wording for a proposed (not yet confirmed) action. */
const WILL_CONFIG_KEYS: Record<string, ChatReplyKey> = {
  add_etf: "willAddEtf",
  remove_etf: "willRemoveEtf",
  track_field: "willTrackField",
  untrack_field: "willUntrackField",
};
const WILL_WIDGET_KEYS: Record<string, ChatReplyKey> = {
  widget_add: "willAddWidget",
  widget_update: "willUpdateWidget",
  widget_clear: "willClearWidgets",
  widget_replace: "willReplaceWidgets",
};

const PLAN_REFUSED_KEYS: Record<PlanRefusedReason, ChatReplyKey> = {
  tampered: "planRefusedTampered",
  expired: "planRefusedExpired",
  state_changed: "planRefusedStateChanged",
  unavailable: "planUnavailable",
};

/** Closed map of every reason code this chat can surface to a `Chat.reasons` key (US-055). */
const REASON_KEYS: Record<string, ChatReasonKey> = {
  malformed: "malformed",
  unsupported: "unsupported",
  model_unclear: "malformed",
  unknown_operation: "unknownOperation",
  unknown_etf: "unknownEtf",
  unknown_field: "unknownField",
  bad_period: "badPeriod",
  bad_title: "badTitle",
  bad_slot: "badSlot",
  too_many: "tooManyWidgets",
  symbol_not_in_message: "symbolNotInMessage",
  already_tracked: "alreadyTracked",
  not_tracked: "notTracked",
  all_not_allowed: "allNotAllowed",
  no_active_etfs: "noActiveEtfs",
};

export function unavailableReplyKey(reason: ChatUnavailableReason): ChatReplyKey {
  return UNAVAILABLE_KEYS[reason];
}

type WhatTarget = NonNullable<WhatDescription["to"]>;

function whatTarget(detail: {
  operation?: string;
  fieldKey?: string;
  field?: { labelRo: string; labelEn: string };
  periodUnit?: string;
  periodAmount?: number;
}): WhatTarget {
  return {
    operation: detail.operation as WhatTarget["operation"],
    fieldKey: detail.fieldKey,
    field: detail.field === undefined ? undefined : { ro: detail.field.labelRo, en: detail.field.labelEn },
    periodUnit: detail.periodUnit as WhatTarget["periodUnit"],
    periodAmount: detail.periodAmount,
  };
}

function whatOf(detail: ActionDetail | undefined): WhatDescription | undefined {
  if (detail === undefined) return undefined;
  return {
    ...whatTarget(detail),
    slot: detail.slot,
    count: detail.count,
    to: detail.to === undefined ? undefined : whatTarget(detail.to),
  };
}

function withWhat<T extends Record<string, unknown>>(base: T, detail: ActionDetail | undefined): T & { what?: WhatDescription } {
  const what = whatOf(detail);
  return what === undefined ? base : { ...base, what };
}

function groupReply(group: ResultGroup): ChatActionReplyState {
  const result = group.first;
  const symbol = group.symbols.join(", ");
  if (result.status === "proposed") {
    const messageKey = result.capability === "configuration" ? WILL_CONFIG_KEYS[result.action]! : WILL_WIDGET_KEYS[result.action]!;
    return withWhat(
      {
        status: result.status,
        index: result.index,
        messageKey,
        values: { symbol },
        ...(result.field === undefined ? {} : { field: { ro: result.field.labelRo, en: result.field.labelEn } }),
      },
      result.detail,
    );
  }
  if (result.status === "failed" && result.configuration === undefined) {
    return withWhat({ index: result.index, status: result.status, messageKey: "actionFailed", values: { symbol } }, result.detail);
  }
  if (result.status === "not_run") {
    return withWhat({ index: result.index, status: result.status, messageKey: "actionNotRun", values: { symbol } }, result.detail);
  }
  if (result.configuration !== undefined) {
    const outcome = result.configuration;
    return {
      status: result.status,
      index: result.index,
      messageKey: EXECUTED_KEYS[outcome.code],
      values: { symbol, adapter: outcome.adapterKey ?? undefined },
      ...(result.field === undefined ? {} : { field: { ro: result.field.labelRo, en: result.field.labelEn } }),
      ...(outcome.detectionReason === null ? {} : { detectionReason: outcome.detectionReason }),
    };
  }
  const messageKey = result.widget?.matched === 0 ? "widgetNothingMatched" : WIDGET_KEYS[result.action];
  return withWhat(
    {
      status: result.status,
      index: result.index,
      messageKey,
      values: {
        symbol,
        ...(group.symbols.length === 1 && result.widget?.slot !== null && result.widget?.slot !== undefined
          ? { slot: result.widget.slot }
          : {}),
      },
    },
    result.detail,
  );
}

function reasonKeyOf(reason: string): ChatReasonKey {
  return REASON_KEYS[reason] ?? "malformed";
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
    case "answered":
      return {
        tone: "info",
        messageKey: outcome.question !== null ? "modelUnclear" : "unsupported",
        modelText: [outcome.reply, outcome.question].filter((t): t is string => t !== null).join("\n\n"),
      };
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
      if (outcome.reason === "etf_inactive" && outcome.symbol !== undefined) {
        return { tone: "info", messageKey: "etfInactive", values: { symbol: outcome.symbol } };
      }
      return {
        tone: "info",
        messageKey: "invalidAction",
        values: { index: outcome.index },
        reason: {
          key: reasonKeyOf(outcome.reason),
          symbol: outcome.symbol,
          field: outcome.field === undefined ? undefined : { ro: outcome.field.labelRo, en: outcome.field.labelEn },
        },
      };
    case "executed_actions": {
      const groups = groupResults(outcome.results);
      const groupReplies = groups.map(groupReply);
      const warning = outcome.results.some((r) => r.status === "failed" || r.status === "not_run");
      if (outcome.reply !== undefined) {
        const complete = outcome.results.every((r) => r.status === "done");
        return {
          tone: warning ? "error" : complete && outcome.results.every((r) => r.changed) ? "success" : "info",
          messageKey: complete ? "actionsComplete" : "actionsPartial",
          modelText: outcome.reply,
          actions: groupReplies,
          ...(warning ? { warning: true as const } : {}),
        };
      }
      if (
        groupReplies.length === 1 &&
        groups[0]!.symbols.length === 1 &&
        groupReplies[0]!.messageKey !== "actionFailed" &&
        groupReplies[0]!.messageKey !== "actionNotRun"
      ) {
        const item = groupReplies[0]!;
        const result = outcome.results[0]!;
        const isSuccess =
          (result.capability === "widgets" && result.widget !== undefined && result.widget.matched !== 0) ||
          result.changed === true;
        return {
          tone: isSuccess ? "success" : "info",
          messageKey: item.messageKey,
          values: item.values,
          field: item.field,
          detectionReason: item.detectionReason,
          ...(item.what === undefined ? {} : { what: item.what }),
        };
      }
      const complete = outcome.results.every((result) => result.status === "done");
      return {
        tone: complete ? "success" : "error",
        messageKey: complete ? "actionsComplete" : "actionsPartial",
        actions: groupReplies,
      };
    }
    case "proposed": {
      const groups = groupResults(outcome.results);
      const groupReplies = groups.map(groupReply);
      return {
        tone: "info",
        messageKey: "planProposed",
        ...(outcome.reply === undefined ? {} : { modelText: outcome.reply }),
        actions: groupReplies,
        plan: { token: outcome.token, status: "pending" },
      };
    }
    case "plan_refused":
      return { tone: "error", messageKey: PLAN_REFUSED_KEYS[outcome.reason] };
    case "error":
      return GENERIC_ERROR_REPLY;
  }
}

/** Attaches the memo the client stores for the next turn's history (US-055 AC4). */
export function buildChatReply(outcome: ChatOutcome): ChatReplyState {
  return { ...chatOutcomeToReply(outcome), memo: historyMemo(outcome) };
}

export function changedActions(outcome: ChatOutcome): readonly ChatActionResult[] {
  if (outcome.kind !== "executed_actions") return [];
  return outcome.results.filter((result) => result.changed && result.status === "done");
}
