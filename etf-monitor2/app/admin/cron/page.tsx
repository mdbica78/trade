import { getDb } from "@/lib/db";
import { createDbDeps } from "@/lib/config/default-deps";
import { getCronHour, DEFAULT_CRON_HOUR_UTC } from "@/lib/config/cron";
import { loadLastRun } from "@/lib/admin/operations";
import { loadOrError } from "@/lib/log/load-error";
import { CronAdmin } from "@/components/admin/CronAdmin";
import { saveCronHourAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
      action={saveCronHourAction}
    />
  );
}
