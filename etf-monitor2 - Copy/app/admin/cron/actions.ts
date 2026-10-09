"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createCronConfigDeps } from "@/lib/config/default-deps";
import { setCronHour } from "@/lib/config/cron";
import type { AdminActionState } from "@/components/admin/action-state";
import { cronHourResultToState } from "./result-messages";

const GENERIC_ERROR: AdminActionState = { status: "error", messageKey: "genericError" };
const INVALID_REQUEST: AdminActionState = { status: "error", messageKey: "invalidRequest" };

export async function saveCronHourAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const hour = formData.get("hour");
  if (typeof hour !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await setCronHour(hour, createCronConfigDeps(getDb()));
    if (result.ok) revalidatePath("/admin/cron");
    return cronHourResultToState(result);
  } catch {
    return GENERIC_ERROR;
  }
}
