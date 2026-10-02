import type { AdminActionState } from "@/components/admin/action-state";
import type { SetAiSettingsResult } from "@/lib/config/ai-settings";
import type { ProviderKeyConfigResult } from "@/lib/config/ai-keys";

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
