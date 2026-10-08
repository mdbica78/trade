import type { AdminActionState } from "@/components/admin/action-state";
import type { SetAiSettingsResult } from "@/lib/config/ai-settings";
import type { ProviderKeyConfigResult } from "@/lib/config/ai-keys";
import type { ConnectionTestResult } from "@/lib/ai/connection-test";
import type { CustomProviderResult } from "@/lib/config/custom-providers";

export function aiSettingsResultToState(result: SetAiSettingsResult): AdminActionState {
  if (!result.ok) {
    return { status: "error", messageKey: result.error === "unknown_provider" ? "unknownProvider" : "invalidModel" };
  }
  return { status: "success", messageKey: result.provider === null ? "aiCleared" : "aiSaved" };
}

export function providerKeyResultToState(
  result: ProviderKeyConfigResult,
  operation: "save" | "clear",
): AdminActionState {
  if (result.ok) {
    return {
      status: "success",
      messageKey: operation === "save" ? "providerKeySaved" : "providerKeyCleared",
    };
  }
  const messageKey = {
    unknown_provider: "unknownProvider",
    key_invalid: "providerKeyInvalid",
    storing_disabled: "providerKeyStorageDisabled",
    write_failed: "providerKeyWriteFailed",
  } as const;
  return { status: "error", messageKey: messageKey[result.error] };
}

export function connectionTestResultToState(result: ConnectionTestResult): AdminActionState {
  if (result.ok) {
    return { status: "success", messageKey: "connectionOk" };
  }
  return { status: "error", messageKey: "connectionFailed", values: { code: result.code } };
}

export function customProviderResultToState(
  result: CustomProviderResult,
  operation: "add" | "update" | "delete",
): AdminActionState {
  if (result.ok) {
    if (operation === "add") return { status: "success", messageKey: "customProviderAdded" };
    if (operation === "delete") return { status: "success", messageKey: "customProviderDeleted" };
    return {
      status: "success",
      messageKey: result.keyRemoved ? "customProviderUpdatedKeyRemoved" : "customProviderUpdated",
    };
  }
  const messageKey = {
    invalid_name: "customProviderInvalidName",
    invalid_url: "customProviderInvalidUrl",
    limit_reached: "customProviderLimitReached",
    not_found: "customProviderNotFound",
  } as const;
  return { status: "error", messageKey: messageKey[result.error] };
}
