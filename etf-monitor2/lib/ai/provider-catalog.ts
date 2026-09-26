export type ProviderDescriptor = {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;
  readonly apiKeyEnvVar: string;
};

/** Decision 10 (sprint-05): a static list until Sprint 6 attaches provider adapters. FR6 order. */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  { id: "gemini", name: "Google Gemini", requiresApiKey: true, apiKeyEnvVar: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", requiresApiKey: true, apiKeyEnvVar: "GROQ_API_KEY" },
  { id: "openrouter", name: "OpenRouter", requiresApiKey: true, apiKeyEnvVar: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", requiresApiKey: true, apiKeyEnvVar: "MISTRAL_API_KEY" },
];

export const PROVIDER_IDS: readonly string[] = PROVIDER_CATALOG.map((p) => p.id);

export function findProvider(id: string | null): ProviderDescriptor | undefined {
  if (id === null) return undefined;
  return PROVIDER_CATALOG.find((p) => p.id === id);
}
