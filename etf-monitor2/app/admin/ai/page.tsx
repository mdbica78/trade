import { getDb } from "@/lib/db";
import { createAiSettingsDeps } from "@/lib/ai/settings-deps";
import { getProviderKeyStatusViews, getProviderKeyStorageEnabled } from "@/lib/ai/provider-deps";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { getAiSettings } from "@/lib/config/ai-settings";
import { loadOrError } from "@/lib/log/load-error";
import { AiSettingsAdmin } from "@/components/admin/AiSettingsAdmin";
import { clearProviderKeyAction, saveAiSettingsAction, saveProviderKeyAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AiSettingsPage() {
  const [loadedSettings, keyRows] = await Promise.all([
    loadOrError("admin/ai", () => getAiSettings(createAiSettingsDeps(getDb()))),
    getProviderKeyStatusViews(),
  ]);
  const settings =
    loadedSettings.status === "ok"
      ? { status: "ok" as const, ...loadedSettings.value }
      : { status: "error" as const };
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
