"use server";

import { getDb } from "@/lib/db";
import { createDbDeps } from "@/lib/config/default-deps";
import { setCronHour } from "@/lib/config/cron";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../run-action";
import { cronHourResultToState } from "./result-messages";

export async function saveCronHourAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const hour = formData.get("hour");
  if (typeof hour !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => setCronHour(hour, createDbDeps(getDb())),
    cronHourResultToState,
    (result) => (result.ok ? ["/admin/cron"] : []),
  );
}
