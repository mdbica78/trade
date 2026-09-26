import { getDb } from "@/lib/db";
import { createAiSettingsDeps } from "@/lib/ai/settings-deps";
import { getKeyStatuses } from "@/lib/ai/key-status";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { getAiSettings } from "@/lib/config/ai-settings";
import { AiSettingsAdmin, type AiSettingsAdminProps } from "@/components/admin/AiSettingsAdmin";
import { saveAiSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

async function loadSettings(): Promise<AiSettingsAdminProps["settings"]> {
  try {
    const settings = await getAiSettings(createAiSettingsDeps(getDb()));
    return { status: "ok", ...settings };
  } catch {
    // AC7: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function AiSettingsPage() {
  const [settings, keyRows] = await Promise.all([loadSettings(), Promise.resolve(getKeyStatuses())]);
  const providers = PROVIDER_CATALOG.map(({ id, name }) => ({ id, name }));

  return <AiSettingsAdmin settings={settings} providers={providers} keyRows={keyRows} action={saveAiSettingsAction} />;
}
