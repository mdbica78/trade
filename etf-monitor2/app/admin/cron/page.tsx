import { getDb } from "@/lib/db";
import { createDbDeps } from "@/lib/config/default-deps";
import { effectiveSchedule, getCronHour, parseDailySchedule } from "@/lib/config/cron";
import { loadOrError } from "@/lib/log/load-error";
import { CronAdmin, type CronAdminProps } from "@/components/admin/CronAdmin";
import { saveCronHourAction } from "./actions";

export const dynamic = "force-dynamic";

function loadEffective(): CronAdminProps["effective"] {
  const schedule = effectiveSchedule();
  const parsed = parseDailySchedule(schedule);
  return parsed !== null ? { status: "ok", hour: parsed.hour } : { status: "unrecognised", schedule };
}

export default async function CronSettingsPage() {
  const effective = loadEffective();
  const loadedDesired = await loadOrError("admin/cron", () => getCronHour(createDbDeps(getDb())));
  const desired =
    loadedDesired.status === "ok"
      ? { status: "ok" as const, hour: loadedDesired.value }
      : { status: "error" as const };
  return <CronAdmin effective={effective} desired={desired} action={saveCronHourAction} />;
}
