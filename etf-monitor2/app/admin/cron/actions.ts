"use server";

import { getDb } from "@/lib/db";
import { createDbDeps } from "@/lib/config/default-deps";
import { saveCronHourAndApply, requestRedeploy } from "@/lib/config/cron-apply";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../run-action";
import { cronHourResultToState } from "./result-messages";

export async function saveCronHourAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const hour = formData.get("hour");
  if (typeof hour !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () =>
      saveCronHourAndApply(hour, {
        config: createDbDeps(getDb()),
        redeploy: () => requestRedeploy({ hookUrl: process.env.VERCEL_DEPLOY_HOOK_URL }),
      }),
    cronHourResultToState,
    (result) => (result.ok ? ["/admin/cron"] : []),
  );
}
