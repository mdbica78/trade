"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";
import { AiProviderModelFields, type AiProviderOption } from "./AiProviderModelFields";
import { ProviderKeyCard } from "./ProviderKeyCard";
import type { ProviderKeyStatusView } from "@/lib/ai/provider-deps";

type KeyProps = {
  keyRows: readonly ProviderKeyStatusView[];
  storageEnabled: boolean;
  saveProviderKeyAction: AdminAction;
  clearProviderKeyAction: AdminAction;
};

/**
 * The save form and the Test connection form share one live provider/model value, so a test runs
 * on what the admin sees, not on what was stored (US-056, DEC-029). The key changes whenever the
 * saved state changes, so the fields restart from the server's state after a Save. The key card
 * below them follows the same live provider choice (US-061).
 */
export function AiSettingsForms({
  providers,
  selectedProvider,
  model,
  models,
  action,
  testConnectionAction,
  ...keyProps
}: {
  providers: readonly AiProviderOption[];
  selectedProvider: string;
  model: string;
  models: Readonly<Record<string, string>>;
  action: AdminAction;
  testConnectionAction: AdminAction;
} & KeyProps) {
  const t = useTranslations("Admin.ai");
  const savedKey = JSON.stringify([selectedProvider, model, models]);
  return (
    <Forms key={savedKey} {...{ t, providers, selectedProvider, model, models, action, testConnectionAction, ...keyProps }} />
  );
}

function Forms({
  t,
  providers,
  selectedProvider,
  model,
  models,
  action,
  testConnectionAction,
  keyRows,
  storageEnabled,
  saveProviderKeyAction,
  clearProviderKeyAction,
}: {
  t: ReturnType<typeof useTranslations>;
  providers: readonly AiProviderOption[];
  selectedProvider: string;
  model: string;
  models: Readonly<Record<string, string>>;
  action: AdminAction;
  testConnectionAction: AdminAction;
} & KeyProps) {
  const [current, setCurrent] = useState({ provider: selectedProvider, model });
  return (
    <>
      <ActionForm action={action} submitLabel={t("saveSubmit")}>
        <AiProviderModelFields
          providers={providers}
          selectedProvider={selectedProvider}
          model={model}
          models={models}
          onChange={setCurrent}
        />
      </ActionForm>
      <ActionForm action={testConnectionAction} submitLabel={t("testConnectionSubmit")}>
        <input type="hidden" name="provider" value={current.provider} />
        <input type="hidden" name="model" value={current.model} />
        <span className="text-xs">{t("testConnectionHint")}</span>
      </ActionForm>
      <ProviderKeyCard
        providerId={current.provider}
        keyRows={keyRows}
        storageEnabled={storageEnabled}
        saveProviderKeyAction={saveProviderKeyAction}
        clearProviderKeyAction={clearProviderKeyAction}
      />
    </>
  );
}
