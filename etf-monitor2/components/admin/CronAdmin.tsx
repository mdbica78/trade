import { useLocale, useTranslations } from "next-intl";
import { bucharestTimeOfUtcHour, formatHourWindow } from "@/lib/config/cron";
import type { LastRun } from "@/lib/admin/operations";
import { isKnownRunStatus } from "@/lib/admin/operations";
import { formatDateTime } from "@/lib/format/datetime";
import type { Locale } from "@/i18n/locale";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";

export type CronAdminProps =
  | { status: "error" }
  | {
      status: "ok";
      /** The effective hour (UTC): the saved one, or the default. */
      hour: number;
      /** False while no hour has been saved and the default applies. */
      saved: boolean;
      lastRun: LastRun | null;
      /** The hour of Vercel's own daily safety-net call, when vercel.json holds a once-a-day schedule. */
      safetyNetHour: number | null;
      action: AdminAction;
    };

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function CronAdmin(props: CronAdminProps) {
  const t = useTranslations("Admin.cron");
  const tOps = useTranslations("Admin.operations");
  const locale = useLocale() as Locale;

  if (props.status === "error") {
    return (
      <div className="max-w-2xl rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2>{t("heading")}</h2>
        <p role="alert">{t("loadError")}</p>
      </div>
    );
  }

  const { hour, saved, lastRun, safetyNetHour, action } = props;
  const utc = formatHourWindow(hour).start;

  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
      <h2>{t("heading")}</h2>

      <p data-cron-effective={hour}>{t("effective", { utc, bucharest: bucharestTimeOfUtcHour(hour) })}</p>
      {!saved ? <p data-cron-default="">{t("defaultNote", { utc })}</p> : null}

      <ActionForm action={action} submitLabel={t("saveSubmit")}>
        <label>
          {t("hourLabel")}
          <select name="hour" defaultValue={String(hour)}>
            {HOURS.map((option) => (
              <option key={option} value={option}>
                {t("hourOption", { utc: formatHourWindow(option).start, bucharest: bucharestTimeOfUtcHour(option) })}
              </option>
            ))}
          </select>
        </label>
      </ActionForm>

      <section data-cron-last-run="">
        <h3>{t("lastRunHeading")}</h3>
        {lastRun === null ? (
          <p>{t("lastRunNone")}</p>
        ) : (
          <p>
            {t("lastRunValue", {
              started: formatDateTime(lastRun.startedAt, locale),
              status: isKnownRunStatus(lastRun.status) ? tOps(`runStatus.${lastRun.status}`) : lastRun.status,
            })}
          </p>
        )}
      </section>

      <section>
        <h3>{t("pingHeading")}</h3>
        <p>{t("pingText")}</p>
        <p>{t("pingRule")}</p>
        {safetyNetHour !== null ? <p>{t("safetyNet", { utc: formatHourWindow(safetyNetHour).start })}</p> : null}
      </section>
    </div>
  );
}
