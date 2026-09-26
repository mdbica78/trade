import { getDb } from "@/lib/db";
import { createCronConfigDeps } from "@/lib/config/default-deps";
import { effectiveSchedule, getCronHour, parseDailySchedule } from "@/lib/config/cron";
import { CronAdmin, type CronAdminProps } from "@/components/admin/CronAdmin";
import { saveCronHourAction } from "./actions";

export const dynamic = "force-dynamic";

function loadEffective(): CronAdminProps["effective"] {
  const schedule = effectiveSchedule();
  const parsed = parseDailySchedule(schedule);
  return parsed !== null ? { status: "ok", hour: parsed.hour } : { status: "unrecognised", schedule };
}

async function loadDesired(): Promise<CronAdminProps["desired"]> {
  try {
    const hour = await getCronHour(createCronConfigDeps(getDb()));
    return { status: "ok", hour };
  } catch {
    // AC8: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function CronSettingsPage() {
  const [effective, desired] = [loadEffective(), await loadDesired()];
  return <CronAdmin effective={effective} desired={desired} action={saveCronHourAction} />;
}
