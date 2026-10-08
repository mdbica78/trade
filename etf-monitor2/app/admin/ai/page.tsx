import { getDb } from "@/lib/db";
import { createAiSettingsDeps } from "@/lib/ai/settings-deps";
import { getCustomProviderViews, getProviderKeyStatusViews, getProviderKeyStorageEnabled } from "@/lib/ai/provider-deps";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { getAiSettings } from "@/lib/config/ai-settings";
import { loadOrError } from "@/lib/log/load-error";
import { AiSettingsAdmin } from "@/components/admin/AiSettingsAdmin";
import { CustomProvidersAdmin } from "@/components/admin/CustomProvidersAdmin";
import {
  addCustomProviderAction,
  clearProviderKeyAction,
  deleteCustomProviderAction,
  saveAiSettingsAction,
  saveProviderKeyAction,
  testConnectionAction,
  updateCustomProviderAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export default async function AiSettingsPage() {
  const [loadedSettings, keyRows, customProviders] = await Promise.all([
    loadOrError("admin/ai", () => getAiSettings(createAiSettingsDeps(getDb()))),
    getProviderKeyStatusViews(),
    getCustomProviderViews(),
  ]);
  const settings =
    loadedSettings.status === "ok"
      ? { status: "ok" as const, ...loadedSettings.value }
      : { status: "error" as const };
  const presets = PROVIDER_CATALOG.map(({ id, name, modelSuggestions }) => ({ id, name, modelSuggestions }));
  const providers = [
    ...presets,
    ...(customProviders.status === "ok"
      ? customProviders.providers.map(({ id, name }) => ({ id, name, modelSuggestions: [] }))
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <AiSettingsAdmin
        settings={settings}
        providers={providers}
        keyRows={keyRows}
        action={saveAiSettingsAction}
        storageEnabled={getProviderKeyStorageEnabled()}
        saveProviderKeyAction={saveProviderKeyAction}
        clearProviderKeyAction={clearProviderKeyAction}
        testConnectionAction={testConnectionAction}
      />
      <CustomProvidersAdmin
        customProviders={customProviders}
        storageEnabled={getProviderKeyStorageEnabled()}
        addAction={addCustomProviderAction}
        updateAction={updateCustomProviderAction}
        deleteAction={deleteCustomProviderAction}
        saveProviderKeyAction={saveProviderKeyAction}
        clearProviderKeyAction={clearProviderKeyAction}
      />
    </div>
  );
}
