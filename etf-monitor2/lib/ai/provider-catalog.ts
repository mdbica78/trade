/** DEC-027 §2: which structured-output mode a provider's adapter uses for a chat answer. */
export type StructuredOutputMode = "json_schema" | "json_object" | "none";

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
  readonly structuredOutput: StructuredOutputMode;
};

/** DEC-026 §1: the shipped provider roster (PO review, 2026-10-05), each with its own implemented
 * adapter and fixed endpoint. Gemini and Groq are the original sprint-6 pair; the other six are
 * OpenAI-compatible presets (US-056). Adding a preset later is one entry here plus one row in
 * `lib/ai/providers/openai-compatible.ts`'s `OPENAI_COMPATIBLE_PRESETS` table. */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    requiresApiKey: true,
    apiKeyEnvVar: "GEMINI_API_KEY",
    modelSuggestions: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    structuredOutput: "json_schema",
  },
  {
    id: "groq",
    name: "Groq",
    requiresApiKey: true,
    apiKeyEnvVar: "GROQ_API_KEY",
    modelSuggestions: [
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-20b",
      "llama-3.1-8b-instant",
    ],
    structuredOutput: "json_schema",
  },
  {
    id: "openai",
    name: "OpenAI",
    requiresApiKey: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
    modelSuggestions: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
    structuredOutput: "json_schema",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    requiresApiKey: true,
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    modelSuggestions: [
      "openai/gpt-oss-120b",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
    ],
    structuredOutput: "json_object",
  },
  {
    id: "mistral",
    name: "Mistral",
    requiresApiKey: true,
    apiKeyEnvVar: "MISTRAL_API_KEY",
    modelSuggestions: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    structuredOutput: "json_schema",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    requiresApiKey: true,
    apiKeyEnvVar: "DEEPSEEK_API_KEY",
    modelSuggestions: ["deepseek-chat"],
    structuredOutput: "json_object",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    requiresApiKey: true,
    apiKeyEnvVar: "CEREBRAS_API_KEY",
    modelSuggestions: ["gpt-oss-120b", "llama-3.3-70b", "llama3.1-8b"],
    structuredOutput: "json_schema",
  },
  {
    id: "together",
    name: "Together AI",
    requiresApiKey: true,
    apiKeyEnvVar: "TOGETHER_API_KEY",
    modelSuggestions: [
      "openai/gpt-oss-120b",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
    ],
    structuredOutput: "json_object",
  },
];

export const PROVIDER_IDS: readonly string[] = PROVIDER_CATALOG.map((p) => p.id);

export function findProvider(id: string | null): ProviderDescriptor | undefined {
  if (id === null) return undefined;
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

/** DEC-027 §2: a custom (non-catalogue) provider id defaults to `json_object`. */
export function structuredOutputFor(id: string): StructuredOutputMode {
  return findProvider(id)?.structuredOutput ?? "json_object";
}
