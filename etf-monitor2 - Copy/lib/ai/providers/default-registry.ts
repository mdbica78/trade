import { createProviderRegistry, type ProviderRegistry } from "./registry";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { AiProvider } from "./types";

// Adapters are code, not configuration (requirements section 5); sprint 6 decision 5 (Gemini + Groq).
export const SHIPPED_PROVIDER_ADAPTERS: readonly AiProvider[] = [geminiProvider, groqProvider];

export function createDefaultProviderRegistry(): ProviderRegistry {
  return createProviderRegistry(SHIPPED_PROVIDER_ADAPTERS);
}
