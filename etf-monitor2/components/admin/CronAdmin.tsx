import { useTranslations } from "next-intl";
import { formatHourWindow, scheduleChangeNeeded, suggestedScheduleLine } from "@/lib/config/cron";
import type { AdminActionState } from "./action-state";
import { ActionForm } from "./ActionForm";

export type CronAdminProps = {
  effective: { status: "ok"; hour: number } | { status: "unrecognised"; schedule: string | null };
  desired: { status: "ok"; hour: number | null } | { status: "error" };
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function CronAdmin(props: CronAdminProps) {
  const t = useTranslations("Admin.cron");
  const { effective, desired, action } = props;

  const effectiveHour = effective.status === "ok" ? effective.hour : null;
  const notice =
    desired.status === "ok" && scheduleChangeNeeded(effectiveHour, desired.hour) ? desired.hour : null;

  return (
    <div>
      <h2>{t("heading")}</h2>

      {effective.status === "ok" ? (
        <p data-cron-effective="ok">{t("effectiveWindow", formatHourWindow(effective.hour))}</p>
      ) : (
        <p data-cron-effective="unrecognised">
          {t("unrecognisedSchedule")}
          {effective.schedule !== null ? <code>{effective.schedule}</code> : null}
        </p>
      )}

      {desired.status === "error" ? (
        <p role="alert">{t("loadError")}</p>
      ) : (
        <ActionForm action={action} submitLabel={t("saveSubmit")}>
          <label>
            {t("hourLabel")}
            <select name="hour" defaultValue={desired.hour === null ? "" : String(desired.hour)}>
              <option value="">{t("notSetOption")}</option>
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {t("hourOption", formatHourWindow(hour))}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      )}

      {notice !== null ? (
        <div data-cron-notice="">
          <p>{t("changeNotice", formatHourWindow(notice))}</p>
          <code>{suggestedScheduleLine(notice)}</code>
          <p>{t("changeNoticeSteps")}</p>
        </div>
      ) : null}

      <p>{t("hobbyNote")}</p>
    </div>
  );
}
