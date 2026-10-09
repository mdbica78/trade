"use server";

import { getDb } from "@/lib/db";
import { createAiSettingsDeps, createProviderKeyConfigDeps } from "@/lib/ai/settings-deps";
import { setAiSettings } from "@/lib/config/ai-settings";
import { clearProviderKey, createCustomProviderConfigDeps, saveProviderKey } from "@/lib/config/ai-keys";
import { addCustomProvider, deleteCustomProvider, updateCustomProvider } from "@/lib/config/custom-providers";
import { testProviderConnection } from "@/lib/ai/connection-test";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../run-action";
import {
  aiSettingsResultToState,
  connectionTestResultToState,
  customProviderResultToState,
  providerKeyResultToState,
} from "./result-messages";

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

export async function testConnectionAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const provider = formData.get("provider");
  const model = formData.get("model");
  const target =
    typeof provider === "string" && provider.trim() !== "" ? { provider, model: typeof model === "string" ? model : "" } : null;
  return runAdminAction(() => testProviderConnection(undefined, { target }), connectionTestResultToState);
}

export async function addCustomProviderAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const name = formData.get("name");
  const baseUrl = formData.get("baseUrl");
  if (typeof name !== "string" || typeof baseUrl !== "string") return INVALID_REQUEST;
  return runAdminAction(
    () => addCustomProvider({ name, baseUrl }, createCustomProviderConfigDeps(getDb())),
    (result) => customProviderResultToState(result, "add"),
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}

export async function updateCustomProviderAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = formData.get("id");
  const name = formData.get("name");
  const baseUrl = formData.get("baseUrl");
  if (typeof id !== "string" || typeof name !== "string" || typeof baseUrl !== "string") return INVALID_REQUEST;
  return runAdminAction(
    () => updateCustomProvider({ id, name, baseUrl }, createCustomProviderConfigDeps(getDb())),
    (result) => customProviderResultToState(result, "update"),
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}

export async function deleteCustomProviderAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return INVALID_REQUEST;
  return runAdminAction(
    () => deleteCustomProvider(id, createCustomProviderConfigDeps(getDb())),
    (result) => customProviderResultToState(result, "delete"),
    (result) => (result.ok ? ["/admin/ai"] : []),
  );
}
