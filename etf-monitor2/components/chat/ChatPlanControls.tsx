import { useTranslations } from "next-intl";
import { CANCEL_INTENT, CONFIRM_INTENT } from "./transcript";

export function ChatPlanControls({ pending }: { pending: boolean }) {
  const t = useTranslations("Chat");
  return (
    <div className="flex gap-2">
      <button type="submit" name="intent" value={CONFIRM_INTENT} formNoValidate disabled={pending} className="self-start">
        {t("confirm")}
      </button>
      <button type="submit" name="intent" value={CANCEL_INTENT} formNoValidate disabled={pending} className="self-start">
        {t("cancel")}
      </button>
    </div>
  );
}
