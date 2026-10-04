"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AI_MODEL_MAX_LENGTH } from "@/lib/config/ai-settings";

export type AiProviderOption = { id: string; name: string; modelSuggestions: readonly string[] };

const MODEL_DATALIST_ID = "ai-model-suggestions";

/** Pure lookup, independently testable without rendering (US-041 AC3): an unknown or empty provider id yields no suggestions. */
export function suggestionsForProvider(providers: readonly AiProviderOption[], providerId: string): readonly string[] {
  return providers.find((p) => p.id === providerId)?.modelSuggestions ?? [];
}

/**
 * The provider selector and free-text model field (US-041). Choosing a preset swaps the static
 * model suggestions shown through a `<datalist>`; picking one, or typing anything else, only ever
 * fills the same bounded `model` text input — no suggestion issues a request, and no endpoint or
 * `baseUrl` field is rendered (FR16; DEC-021 §8).
 */
export function AiProviderModelFields({
  providers,
  selectedProvider,
  model,
}: {
  providers: readonly AiProviderOption[];
  selectedProvider: string;
  model: string;
}) {
  const t = useTranslations("Admin.ai");
  const [provider, setProvider] = useState(selectedProvider);
  const suggestions = suggestionsForProvider(providers, provider);

  return (
    <>
      <label>
        {t("providerLabel")}
        <select name="provider" defaultValue={selectedProvider} onChange={(event) => setProvider(event.target.value)}>
          <option value="">{t("noneOption")}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("modelLabel")}
        <input type="text" name="model" maxLength={AI_MODEL_MAX_LENGTH} defaultValue={model} list={MODEL_DATALIST_ID} />
      </label>
      <datalist id={MODEL_DATALIST_ID}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <p className="text-xs">{t("modelHint")}</p>
    </>
  );
}
