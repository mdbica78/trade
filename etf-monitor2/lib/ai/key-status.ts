import { PROVIDER_CATALOG } from "./provider-catalog";

export type ProviderKeyStatus = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  isSet: boolean;
};

/**
 * The only file that reads a provider API key variable. It returns booleans only — never the
 * value — so this must stay the sole importer of `process.env[<key var>]` in the repo (AGENTS.md
 * Secrets, DEC-015). Read at request time (the caller must render dynamically), not at build.
 */
export function getKeyStatuses(): ProviderKeyStatus[] {
  return PROVIDER_CATALOG.map((provider) => {
    const value = process.env[provider.apiKeyEnvVar];
    const isSet = typeof value === "string" && value.trim() !== "";
    return {
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet,
    };
  });
}
