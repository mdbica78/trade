import { useTranslations } from "next-intl";
import type { CustomProviderView } from "@/lib/ai/provider-deps";
import { CUSTOM_PROVIDER_MAX, CUSTOM_PROVIDER_NAME_MAX_LENGTH, CUSTOM_PROVIDER_URL_MAX_LENGTH } from "@/lib/config/custom-providers";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";
import { ProviderKeySaveForm } from "./ProviderKeySaveForm";

export type CustomProvidersAdminProps = {
  customProviders: { status: "ok"; providers: readonly CustomProviderView[] } | { status: "error" };
  storageEnabled: boolean;
  addAction: AdminAction;
  updateAction: AdminAction;
  deleteAction: AdminAction;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
};

export function CustomProvidersAdmin(props: CustomProvidersAdminProps) {
  const t = useTranslations("Admin.ai");
  const { customProviders, storageEnabled, addAction, updateAction, deleteAction, saveProviderKeyAction, clearProviderKeyAction } = props;

  if (customProviders.status === "error") {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2>{t("customHeading")}</h2>
        <p role="alert">{t("customLoadError")}</p>
      </div>
    );
  }

  const providers = customProviders.providers;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
      <h2>{t("customHeading")}</h2>
      <p className="text-xs">{t("customIntro")}</p>

      {providers.length === 0 ? <p>{t("customEmpty")}</p> : null}

      {providers.map((provider) => (
        <section key={provider.id} className="mt-4 rounded-[var(--radius)] border border-[var(--line)] p-3">
          <h3>{provider.name}</h3>
          <p>
            <code>{provider.baseUrl}</code>
          </p>
          <p data-custom-key-status={provider.keySet ? "set" : "not-set"}>
            {provider.keySet ? t("customKeySet") : t("customKeyNotSet")}
          </p>

          <ActionForm action={updateAction} submitLabel={t("customUpdateSubmit")}>
            <input type="hidden" name="id" value={provider.id} />
            <label>
              {t("customNameLabel")}
              <input type="text" name="name" maxLength={CUSTOM_PROVIDER_NAME_MAX_LENGTH} defaultValue={provider.name} />
            </label>
            <label>
              {t("customUrlLabel")}
              <input type="url" name="baseUrl" maxLength={CUSTOM_PROVIDER_URL_MAX_LENGTH} defaultValue={provider.baseUrl} />
            </label>
            <span className="text-xs">{t("customUrlChangeWarning")}</span>
          </ActionForm>

          <ActionForm action={deleteAction} submitLabel={t("customDeleteSubmit")}>
            <input type="hidden" name="id" value={provider.id} />
          </ActionForm>

          {storageEnabled ? (
            <>
              <ProviderKeySaveForm
                action={saveProviderKeyAction}
                providerId={provider.id}
                inputLabel={t("keyInputLabel", { provider: provider.name })}
                submitLabel={t(provider.keySet ? "replaceKey" : "saveKey")}
              />
              {provider.keySet ? (
                <ActionForm action={clearProviderKeyAction} submitLabel={t("clearStoredKey")}>
                  <input type="hidden" name="providerId" value={provider.id} />
                </ActionForm>
              ) : null}
            </>
          ) : (
            <p role="note">{t("customStorageDisabled")}</p>
          )}
        </section>
      ))}

      {providers.length < CUSTOM_PROVIDER_MAX ? (
        <ActionForm action={addAction} submitLabel={t("customAddSubmit")}>
          <label>
            {t("customNameLabel")}
            <input type="text" name="name" maxLength={CUSTOM_PROVIDER_NAME_MAX_LENGTH} />
          </label>
          <label>
            {t("customUrlLabel")}
            <input type="url" name="baseUrl" maxLength={CUSTOM_PROVIDER_URL_MAX_LENGTH} />
          </label>
          <span className="text-xs">{t("customUrlHint")}</span>
        </ActionForm>
      ) : (
        <p>{t("customLimitNote")}</p>
      )}
    </div>
  );
}
