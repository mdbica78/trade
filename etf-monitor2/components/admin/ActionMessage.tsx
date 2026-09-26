import { useTranslations } from "next-intl";
import type { AdminActionState } from "./action-state";

export function ActionMessage({ state }: { state: AdminActionState }) {
  const t = useTranslations("Admin.messages");
  const tReason = useTranslations("Admin.detectionReason");

  if (state.status === "idle") {
    return null;
  }

  return (
    <p role={state.status === "error" ? "alert" : "status"}>
      {t(state.messageKey, state.values)}
      {state.reason ? ` (${tReason(state.reason)})` : null}
    </p>
  );
}
