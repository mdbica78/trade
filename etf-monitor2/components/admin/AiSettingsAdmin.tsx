import { useTranslations } from "next-intl";
import { AI_MODEL_MAX_LENGTH } from "@/lib/config/ai-settings";
import type { AdminActionState } from "./action-state";
import { ActionForm } from "./ActionForm";

type ProviderOption = { id: string; name: string };
type KeyRow = { id: string; name: string; requiresApiKey: boolean; apiKeyEnvVar: string; isSet: boolean };

export type AiSettingsAdminProps = {
  settings: { status: "ok"; provider: string | null; model: string | null } | { status: "error" };
  providers: readonly ProviderOption[];
  keyRows: readonly KeyRow[];
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
};

export function AiSettingsAdmin(props: AiSettingsAdminProps) {
  const t = useTranslations("Admin.ai");
  const { settings, providers, keyRows, action } = props;

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
    <div>
      <h2>{t("heading")}</h2>

      {settings.status === "error" ? (
        <p role="alert">{t("loadError")}</p>
      ) : (
        <>
          {unknownStoredProvider !== null ? <p>{t("unknownStoredProvider", { provider: unknownStoredProvider })}</p> : null}
          <ActionForm action={action} submitLabel={t("saveSubmit")}>
            <label>
              {t("providerLabel")}
              <select name="provider" defaultValue={selected}>
                <option value="">{t("noneOption")}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("modelLabel")}
              <input type="text" name="model" maxLength={AI_MODEL_MAX_LENGTH} defaultValue={model} />
            </label>
            <p>{t("modelHint")}</p>
          </ActionForm>
        </>
      )}

      <h3>{t("keysHeading")}</h3>
      <table>
        <thead>
          <tr>
            <th>{t("providerColumn")}</th>
            <th>{t("keyRequiredColumn")}</th>
            <th>{t("variableColumn")}</th>
            <th>{t("statusColumn")}</th>
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
              <td data-key-status={row.isSet ? "set" : "not-set"}>{row.isSet ? t("keySet") : t("keyNotSet")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t("keysNote")}</p>
      <p>{t("chatUnavailableNote")}</p>
    </div>
  );
}
