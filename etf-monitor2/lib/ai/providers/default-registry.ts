import { createProviderRegistry, type ProviderRegistry } from "./registry";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { OPENAI_COMPATIBLE_PRESET_ADAPTERS } from "./openai-compatible";
import type { AiProvider } from "./types";

// Adapters are code, not configuration (requirements section 5); roster per DEC-026 §1.
export const SHIPPED_PROVIDER_ADAPTERS: readonly AiProvider[] = [
  geminiProvider,
  groqProvider,
  ...OPENAI_COMPATIBLE_PRESET_ADAPTERS,
];

export function createDefaultProviderRegistry(): ProviderRegistry {
  return createProviderRegistry(SHIPPED_PROVIDER_ADAPTERS);
}
