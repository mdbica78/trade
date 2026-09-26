import type { AdminActionState } from "@/components/admin/action-state";
import type { SetCronHourResult } from "@/lib/config/cron";

export function cronHourResultToState(result: SetCronHourResult): AdminActionState {
  if (!result.ok) {
    return { status: "error", messageKey: "invalidHour" };
  }
  return { status: "success", messageKey: result.hour === null ? "cronCleared" : "cronSaved" };
}
