import { CHAT_MESSAGE_MAX_LENGTH, type ChatOutcome, type ChatUnavailableReason } from "@/lib/ai/chat";
import type { ProviderErrorCode } from "@/lib/ai/providers/types";
import type { ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import type { UnclearReason } from "@/lib/ai/capabilities/configuration/intent";
import type { ChatReplyKey, ChatReplyState } from "@/components/chat/chat-state";

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

/** Bold rows: the grounding-reason and the matching config-result share one key (tech-lead point 2). */
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

export function unavailableReplyKey(reason: ChatUnavailableReason): ChatReplyKey {
  return UNAVAILABLE_KEYS[reason];
}

export function chatOutcomeToReply(outcome: ChatOutcome): ChatReplyState {
  switch (outcome.kind) {
    case "invalid_message":
      if (outcome.reason === "empty") return { tone: "error", messageKey: "emptyMessage" };
      return { tone: "error", messageKey: "tooLong", values: { max: CHAT_MESSAGE_MAX_LENGTH } };

    case "unavailable":
      return { tone: "info", messageKey: unavailableReplyKey(outcome.reason), adminLink: true };

    case "interpreted": {
      const interpreted = outcome.outcome;
      const field = outcome.field !== null ? { ro: outcome.field.labelRo, en: outcome.field.labelEn } : undefined;
      if (interpreted.kind === "unsupported") return { tone: "info", messageKey: "unsupported" };
      if (interpreted.kind === "multiple") return { tone: "info", messageKey: "multiple" };
      if (interpreted.kind === "provider_error") {
        const key = PROVIDER_ERROR_KEYS[interpreted.error];
        return {
          tone: "error",
          messageKey: key,
          adminLink: key === "providerModelNotFound" ? true : undefined,
        };
      }
      // unclear
      return {
        tone: "info",
        messageKey: UNCLEAR_KEYS[interpreted.reason],
        values: interpreted.symbol !== undefined ? { symbol: interpreted.symbol } : undefined,
        field,
      };
    }

    case "executed": {
      const result = outcome.result;
      const field = result.field !== null ? { ro: result.field.labelRo, en: result.field.labelEn } : undefined;
      const tone: ChatReplyState["tone"] = ["added", "added_no_adapter", "reactivated", "removed", "tracked", "untracked"].includes(
        result.code,
      )
        ? "success"
        : "info";
      return {
        tone,
        messageKey: EXECUTED_KEYS[result.code],
        values: { symbol: result.symbol, adapter: result.adapterKey ?? undefined },
        field,
        detectionReason: result.detectionReason ?? undefined,
      };
    }

    case "error":
      return GENERIC_ERROR_REPLY;
  }
}

export function changedSymbol(outcome: ChatOutcome): string | null {
  if (outcome.kind !== "executed" || !outcome.result.changed) return null;
  return outcome.result.symbol;
}
