"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createAiSettingsDeps, createProviderKeyConfigDeps } from "@/lib/ai/settings-deps";
import { setAiSettings } from "@/lib/config/ai-settings";
import { clearProviderKey, saveProviderKey } from "@/lib/config/ai-keys";
import type { AdminActionState } from "@/components/admin/action-state";
import { aiSettingsResultToState, providerKeyResultToState } from "./result-messages";

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

export async function saveProviderKeyAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const providerId = formData.get("providerId");
  const key = formData.get("key");
  if (typeof providerId !== "string" || typeof key !== "string") return INVALID_REQUEST;
  try {
    const result = await saveProviderKey({ providerId, key }, createProviderKeyConfigDeps(getDb()));
    if (result.ok) revalidatePath("/admin/ai");
    return providerKeyResultToState(result, "save");
  } catch {
    return GENERIC_ERROR;
  }
}

export async function clearProviderKeyAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const providerId = formData.get("providerId");
  if (typeof providerId !== "string") return INVALID_REQUEST;
  try {
    const result = await clearProviderKey(providerId, createProviderKeyConfigDeps(getDb()));
    if (result.ok) revalidatePath("/admin/ai");
    return providerKeyResultToState(result, "clear");
  } catch {
    return GENERIC_ERROR;
  }
}
