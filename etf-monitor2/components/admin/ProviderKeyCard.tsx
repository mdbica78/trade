"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProviderKeyStatusView } from "@/lib/ai/provider-deps";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";
import { ProviderKeySaveForm } from "./ProviderKeySaveForm";

const SOURCE_MESSAGE_KEYS = {
  stored: "sourceStored",
  environment: "sourceEnvironment",
  none: "sourceNone",
} as const;

/**
 * Key management on its own, used when the saved provider settings could not be loaded: the key
 * status does not depend on them, so a key can still be entered (US-061, keeps the former
 * "key table renders when settings fail" behavior). The selector has no `name`, so nothing in it is
 * submitted.
 */
export function ProviderKeyPicker({
  providers,
  ...cardProps
}: {
  providers: readonly { id: string; name: string }[];
  keyRows: readonly ProviderKeyStatusView[];
  storageEnabled: boolean;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
}) {
  const t = useTranslations("Admin.ai");
  const [providerId, setProviderId] = useState("");
  return (
    <div className="mt-4">
      <label>
        {t("providerLabel")}
        <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
          <option value="">{t("noneOption")}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <ProviderKeyCard providerId={providerId} {...cardProps} />
    </div>
  );
}

/**
 * The key status and write-only key controls of the provider currently chosen in the selector —
 * only that one, never a list (US-061 AC1). It only ever receives the key-free status view.
 */
export function ProviderKeyCard({
  providerId,
  keyRows,
  storageEnabled,
  saveProviderKeyAction,
  clearProviderKeyAction,
}: {
  providerId: string;
  keyRows: readonly ProviderKeyStatusView[];
  storageEnabled: boolean;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
}) {
  const t = useTranslations("Admin.ai");
  const row = keyRows.find((candidate) => candidate.id === providerId);

  return (
    <section
      className="mt-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--head)] p-3"
      aria-labelledby="ai-key-card-heading"
      data-key-card={providerId}
    >
      <h3 id="ai-key-card-heading">{t("keysHeading")}</h3>
      {providerId === "" ? (
        <p>{t("keyCardNone")}</p>
      ) : row === undefined ? (
        <p>{t("keyCardCustom")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-[var(--muted)]">{t("providerLabel")}</dt>
            <dd>{row.name}</dd>
            <dt className="text-[var(--muted)]">{t("keyRequiredColumn")}</dt>
            <dd>{row.requiresApiKey ? t("keyRequired") : t("keyNotRequired")}</dd>
            <dt className="text-[var(--muted)]">{t("variableColumn")}</dt>
            <dd>
              <code>{row.apiKeyEnvVar}</code>
            </dd>
            <dt className="text-[var(--muted)]">{t("statusColumn")}</dt>
            <dd data-key-status={row.isSet ? "set" : "not-set"}>{row.isSet ? t("keySet") : t("keyNotSet")}</dd>
            <dt className="text-[var(--muted)]">{t("sourceColumn")}</dt>
            <dd data-key-source={row.source}>{t(SOURCE_MESSAGE_KEYS[row.source])}</dd>
          </dl>
          <p className="text-xs">{t("keysNote")}</p>
          {!storageEnabled ? <p role="note">{t("storageDisabled")}</p> : null}
          {storageEnabled && row.requiresApiKey ? (
            <div key={row.id} className="mt-2">
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
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
