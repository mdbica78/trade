import type { AdminActionState } from "@/components/admin/action-state";
import type { SaveCronHourResult } from "@/lib/config/cron-apply";

export function cronHourResultToState(result: SaveCronHourResult): AdminActionState {
  if (!result.ok) {
    return { status: "error", messageKey: "invalidHour" };
  }
  if (result.apply === "unchanged") {
    return { status: "success", messageKey: "cronSaved" };
  }
  if (result.apply === "applying") {
    return { status: "success", messageKey: "cronSavedApplying" };
  }
  if (result.apply === "not_configured") {
    return { status: "success", messageKey: "cronSavedNotConfigured" };
  }
  return { status: "success", messageKey: "cronSavedApplyFailed" };
}
