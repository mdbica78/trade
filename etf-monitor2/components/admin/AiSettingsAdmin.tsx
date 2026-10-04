import { useTranslations } from "next-intl";
import Link from "next/link";
import type { AdminActionState } from "./action-state";
import { ActionForm } from "./ActionForm";
import { AiProviderModelFields, type AiProviderOption } from "./AiProviderModelFields";
import { ProviderKeySaveForm } from "./ProviderKeySaveForm";

type ProviderOption = AiProviderOption;
const SOURCE_MESSAGE_KEYS = {
  stored: "sourceStored",
  environment: "sourceEnvironment",
  none: "sourceNone",
} as const;

type KeyRow = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  isSet: boolean;
  source: "stored" | "environment" | "none";
  updatedAt: string | null;
};

export type AiSettingsAdminProps = {
  settings: { status: "ok"; provider: string | null; model: string | null } | { status: "error" };
  providers: readonly ProviderOption[];
  keyRows: readonly KeyRow[];
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  storageEnabled: boolean;
  saveProviderKeyAction: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  clearProviderKeyAction: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
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
          <p role="alert">{t("loadError")}</p>
        ) : (
          <>
            {unknownStoredProvider !== null ? <p>{t("unknownStoredProvider", { provider: unknownStoredProvider })}</p> : null}
            <ActionForm action={action} submitLabel={t("saveSubmit")}>
              <AiProviderModelFields providers={providers} selectedProvider={selected} model={model} />
            </ActionForm>
          </>
        )}
      </div>

      <div>
        <h3>{t("keysHeading")}</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t("providerColumn")}</th>
                <th>{t("keyRequiredColumn")}</th>
                <th>{t("variableColumn")}</th>
                <th>{t("statusColumn")}</th>
                <th>{t("sourceColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {keyRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.requiresApiKey ? t("keyRequired") : t("keyNotRequired")}</td>
                  <td>
                    <code>{row.apiKeyEnvVar}</code>
                  </td>
                  <td data-key-status={row.isSet ? "set" : "not-set"}>
                    {row.isSet ? t("keySet") : t("keyNotSet")}
                  </td>
                  <td data-key-source={row.source}>{t(SOURCE_MESSAGE_KEYS[row.source])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs">{t("keysNote")}</p>
        {!storageEnabled ? <p role="note">{t("storageDisabled")}</p> : null}
        {storageEnabled
          ? keyRows
              .filter((row) => row.requiresApiKey)
              .map((row) => (
                <section key={row.id} className="mt-4 rounded-[var(--radius)] border border-[var(--line)] p-3">
                  <h4>{row.name}</h4>
                  <ProviderKeySaveForm
                    action={saveProviderKeyAction}
                    providerId={row.id}
                    inputLabel={t("keyInputLabel", { provider: row.name })}
                    submitLabel={t(row.isSet ? "replaceKey" : "saveKey")}
                  />
                  {row.source === "stored" ? (
                    <ActionForm action={clearProviderKeyAction} submitLabel={t("clearStoredKey")}>
                      <input type="hidden" name="providerId" value={row.id} />
                    </ActionForm>
                  ) : null}
                </section>
              ))
          : null}
        <p>
          <Link href="/chat">{t("chatLink")}</Link>
        </p>
      </div>
    </div>
  );
}
