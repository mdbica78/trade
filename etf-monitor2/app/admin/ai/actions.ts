"use server";

import { getDb } from "@/lib/db";
import { createAiSettingsDeps, createProviderKeyConfigDeps } from "@/lib/ai/settings-deps";
import { setAiSettings } from "@/lib/config/ai-settings";
import { clearProviderKey, saveProviderKey } from "@/lib/config/ai-keys";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../run-action";
import { aiSettingsResultToState, providerKeyResultToState } from "./result-messages";

export async function saveAiSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const provider = formData.get("provider");
  const model = formData.get("model");
  if (typeof provider !== "string" || typeof model !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => setAiSettings({ provider, model }, createAiSettingsDeps(getDb())),
    aiSettingsResultToState,
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}

export async function saveProviderKeyAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const providerId = formData.get("providerId");
  const key = formData.get("key");
  if (typeof providerId !== "string" || typeof key !== "string") return INVALID_REQUEST;
  return runAdminAction(
    () => saveProviderKey({ providerId, key }, createProviderKeyConfigDeps(getDb())),
    (result) => providerKeyResultToState(result, "save"),
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}

export async function clearProviderKeyAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const providerId = formData.get("providerId");
  if (typeof providerId !== "string") return INVALID_REQUEST;
  return runAdminAction(
    () => clearProviderKey(providerId, createProviderKeyConfigDeps(getDb())),
    (result) => providerKeyResultToState(result, "clear"),
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}
