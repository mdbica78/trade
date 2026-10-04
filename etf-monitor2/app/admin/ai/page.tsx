import { getDb } from "@/lib/db";
import { createAiSettingsDeps } from "@/lib/ai/settings-deps";
import { getProviderKeyStatusViews, getProviderKeyStorageEnabled } from "@/lib/ai/provider-deps";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { getAiSettings } from "@/lib/config/ai-settings";
import { logLoadError } from "@/lib/log/load-error";
import { AiSettingsAdmin, type AiSettingsAdminProps } from "@/components/admin/AiSettingsAdmin";
import { clearProviderKeyAction, saveAiSettingsAction, saveProviderKeyAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadSettings(): Promise<AiSettingsAdminProps["settings"]> {
  try {
    const settings = await getAiSettings(createAiSettingsDeps(getDb()));
    return { status: "ok", ...settings };
  } catch (error) {
    // AC7: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    logLoadError("admin/ai", error);
    return { status: "error" };
  }
}

export default async function AiSettingsPage() {
  const [settings, keyRows] = await Promise.all([loadSettings(), getProviderKeyStatusViews()]);
  const providers = PROVIDER_CATALOG.map(({ id, name, modelSuggestions }) => ({ id, name, modelSuggestions }));

  return (
    <AiSettingsAdmin
      settings={settings}
      providers={providers}
      keyRows={keyRows}
      action={saveAiSettingsAction}
      storageEnabled={getProviderKeyStorageEnabled()}
      saveProviderKeyAction={saveProviderKeyAction}
      clearProviderKeyAction={clearProviderKeyAction}
    />
  );
}
