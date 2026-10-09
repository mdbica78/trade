import { useTranslations } from "next-intl";
import type { CustomProviderView } from "@/lib/ai/provider-deps";
import { CUSTOM_PROVIDER_MAX, CUSTOM_PROVIDER_NAME_MAX_LENGTH, CUSTOM_PROVIDER_URL_MAX_LENGTH } from "@/lib/config/custom-providers";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";
import { ProviderKeySaveForm } from "./ProviderKeySaveForm";

export type CustomProvidersAdminProps = {
  customProviders: { status: "ok"; providers: readonly CustomProviderView[] } | { status: "error" };
  /** Each provider's saved model (DEC-029), by provider id; key-free. */
  models?: Readonly<Record<string, string>>;
  storageEnabled: boolean;
  addAction: AdminAction;
  updateAction: AdminAction;
  deleteAction: AdminAction;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
};

export function CustomProvidersAdmin(props: CustomProvidersAdminProps) {
  const t = useTranslations("Admin.ai");
  const {
    customProviders,
    models = {},
    storageEnabled,
    addAction,
    updateAction,
    deleteAction,
    saveProviderKeyAction,
    clearProviderKeyAction,
  } = props;

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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <section
            key={provider.id}
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--head)] p-3"
            data-custom-provider={provider.id}
          >
            <h3>{provider.name}</h3>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-[var(--muted)]">{t("customUrlLabel")}</dt>
              <dd className="break-all">
                <code>{provider.baseUrl}</code>
              </dd>
              <dt className="text-[var(--muted)]">{t("customModelLabel")}</dt>
              <dd data-custom-model={models[provider.id] ?? ""}>{models[provider.id] ?? t("customModelNone")}</dd>
              <dt className="text-[var(--muted)]">{t("statusColumn")}</dt>
              <dd data-custom-key-status={provider.keySet ? "set" : "not-set"}>
                {provider.keySet ? t("customKeySet") : t("customKeyNotSet")}
              </dd>
            </dl>

            <details className="mt-2">
              <summary>{t("customEditSummary")}</summary>
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
            </details>

            <details className="mt-2">
              <summary>{t("customKeySummary")}</summary>
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
            </details>

            <div className="mt-2">
              <ActionForm action={deleteAction} submitLabel={t("customDeleteSubmit")}>
                <input type="hidden" name="id" value={provider.id} />
              </ActionForm>
            </div>
          </section>
        ))}
      </div>

      {providers.length < CUSTOM_PROVIDER_MAX ? (
        <details className="mt-4" data-custom-add>
          <summary>{t("customAddSummary")}</summary>
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
        </details>
      ) : (
        <p className="mt-4">{t("customLimitNote")}</p>
      )}
    </div>
  );
}
