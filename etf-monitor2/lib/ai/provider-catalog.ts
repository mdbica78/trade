export type ProviderDescriptor = {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;
  readonly apiKeyEnvVar: string;
  /**
   * Static, non-exhaustive model-name suggestions shown by the admin UI picker (US-041 AC3). These
   * are never fetched from the provider and are not validated against it — only the existing
   * `AI_MODEL_MAX_LENGTH` free-text bound applies. The endpoint a request goes to is fixed by the
   * matching adapter in `lib/ai/providers/`, never by a model or `baseUrl` value (DEC-021 §8).
   */
  readonly modelSuggestions: readonly string[];
};

/** Sprint 6 decision 5: the two providers with a shipped adapter (Google Gemini, Groq). FR6 order.
 * US-041 D-1 (PRODUCT, PROPOSED / NEEDS USER): the preset roster stays exactly these two until the
 * PO names additional vendors; each would need its own implemented adapter and fixed endpoint. */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    requiresApiKey: true,
    apiKeyEnvVar: "GEMINI_API_KEY",
    modelSuggestions: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    id: "groq",
    name: "Groq",
    requiresApiKey: true,
    apiKeyEnvVar: "GROQ_API_KEY",
    modelSuggestions: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
  },
];

export const PROVIDER_IDS: readonly string[] = PROVIDER_CATALOG.map((p) => p.id);

export function findProvider(id: string | null): ProviderDescriptor | undefined {
  if (id === null) return undefined;
  return PROVIDER_CATALOG.find((p) => p.id === id);
}
