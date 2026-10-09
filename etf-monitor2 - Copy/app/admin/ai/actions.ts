"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createAiSettingsDeps } from "@/lib/ai/settings-deps";
import { setAiSettings } from "@/lib/config/ai-settings";
import type { AdminActionState } from "@/components/admin/action-state";
import { aiSettingsResultToState } from "./result-messages";

const GENERIC_ERROR: AdminActionState = { status: "error", messageKey: "genericError" };
const INVALID_REQUEST: AdminActionState = { status: "error", messageKey: "invalidRequest" };

export async function saveAiSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const provider = formData.get("provider");
  const model = formData.get("model");
  if (typeof provider !== "string" || typeof model !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await setAiSettings({ provider, model }, createAiSettingsDeps(getDb()));
    if (result.ok) revalidatePath("/admin/ai");
    return aiSettingsResultToState(result);
  } catch {
    return GENERIC_ERROR;
  }
}
