"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";
import { AiProviderModelFields, type AiProviderOption } from "./AiProviderModelFields";

/**
 * The save form and the Test connection form share one live provider/model value, so a test runs
 * on what the admin sees, not on what was stored (US-056, DEC-029). The key changes whenever the
 * saved state changes, so the fields restart from the server's state after a Save.
 */
export function AiSettingsForms({
  providers,
  selectedProvider,
  model,
  models,
  action,
  testConnectionAction,
}: {
  providers: readonly AiProviderOption[];
  selectedProvider: string;
  model: string;
  models: Readonly<Record<string, string>>;
  action: AdminAction;
  testConnectionAction: AdminAction;
}) {
  const t = useTranslations("Admin.ai");
  const savedKey = JSON.stringify([selectedProvider, model, models]);
  return <Forms key={savedKey} {...{ t, providers, selectedProvider, model, models, action, testConnectionAction }} />;
}

function Forms({
  t,
  providers,
  selectedProvider,
  model,
  models,
  action,
  testConnectionAction,
}: {
  t: ReturnType<typeof useTranslations>;
  providers: readonly AiProviderOption[];
  selectedProvider: string;
  model: string;
  models: Readonly<Record<string, string>>;
  action: AdminAction;
  testConnectionAction: AdminAction;
}) {
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
    </>
  );
}
