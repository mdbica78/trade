import type { AdminActionState } from "@/components/admin/action-state";
import type { SetAiSettingsResult } from "@/lib/config/ai-settings";

export function aiSettingsResultToState(result: SetAiSettingsResult): AdminActionState {
  if (!result.ok) {
    return { status: "error", messageKey: result.error === "unknown_provider" ? "unknownProvider" : "invalidModel" };
  }
  return { status: "success", messageKey: result.provider === null ? "aiCleared" : "aiSaved" };
}
