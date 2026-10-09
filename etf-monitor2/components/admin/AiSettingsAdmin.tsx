import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ProviderKeyStatusView } from "@/lib/ai/provider-deps";
import type { AdminAction } from "./action-state";
import { AiSettingsForms } from "./AiSettingsForms";
import type { AiProviderOption } from "./AiProviderModelFields";
import { ProviderKeyPicker } from "./ProviderKeyCard";

export type AiSettingsAdminProps = {
  settings:
    | { status: "ok"; provider: string | null; model: string | null; models?: Readonly<Record<string, string>> }
    | { status: "error" };
  providers: readonly AiProviderOption[];
  keyRows: readonly ProviderKeyStatusView[];
  action: AdminAction;
  storageEnabled: boolean;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
  testConnectionAction: AdminAction;
};

export function AiSettingsAdmin(props: AiSettingsAdminProps) {
  const t = useTranslations("Admin.ai");
  const {
    settings,
    providers,
    keyRows,
    action,
    storageEnabled,
    saveProviderKeyAction,
    clearProviderKeyAction,
    testConnectionAction,
  } = props;

  const selected =
    settings.status === "ok" && settings.provider !== null && providers.some((p) => p.id === settings.provider)
      ? settings.provider
      : "";
  const unknownStoredProvider =
    settings.status === "ok" && settings.provider !== null && !providers.some((p) => p.id === settings.provider)
      ? settings.provider
      : null;
  const model = settings.status === "ok" ? (settings.model ?? "") : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2>{t("heading")}</h2>

        {settings.status === "error" ? (
          <>
            <p role="alert">{t("loadError")}</p>
            <ProviderKeyPicker
              providers={providers}
              keyRows={keyRows}
              storageEnabled={storageEnabled}
              saveProviderKeyAction={saveProviderKeyAction}
              clearProviderKeyAction={clearProviderKeyAction}
            />
          </>
        ) : (
          <>
            {unknownStoredProvider !== null ? <p>{t("unknownStoredProvider", { provider: unknownStoredProvider })}</p> : null}
            <AiSettingsForms
              providers={providers}
              selectedProvider={selected}
              model={model}
              models={settings.models ?? {}}
              action={action}
              testConnectionAction={testConnectionAction}
              keyRows={keyRows}
              storageEnabled={storageEnabled}
              saveProviderKeyAction={saveProviderKeyAction}
              clearProviderKeyAction={clearProviderKeyAction}
            />
          </>
        )}
        <p className="mt-4">
          <Link href="/chat">{t("chatLink")}</Link>
        </p>
      </div>
    </div>
  );
}
