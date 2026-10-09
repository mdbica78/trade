import { getDb } from "@/lib/db";
import { createDbDeps } from "@/lib/config/default-deps";
import { effectiveSchedule, getCronHour, DEFAULT_CRON_HOUR_UTC, parseDailySchedule } from "@/lib/config/cron";
import { loadLastRun } from "@/lib/admin/operations";
import { loadOrError } from "@/lib/log/load-error";
import { CronAdmin } from "@/components/admin/CronAdmin";
import { saveCronHourAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CronSettingsPage() {
  const loaded = await loadOrError("admin/cron", async () => {
    const deps = createDbDeps(getDb());
    const [savedHour, lastRun] = await Promise.all([getCronHour(deps), loadLastRun(deps.db, deps.run)]);
    return { savedHour, lastRun };
  });
  if (loaded.status !== "ok") {
    return <CronAdmin status="error" />;
  }
  const { savedHour, lastRun } = loaded.value;
  return (
    <CronAdmin
      status="ok"
      hour={savedHour ?? DEFAULT_CRON_HOUR_UTC}
      saved={savedHour !== null}
      lastRun={lastRun}
      safetyNetHour={parseDailySchedule(effectiveSchedule())?.hour ?? null}
      action={saveCronHourAction}
    />
  );
}
