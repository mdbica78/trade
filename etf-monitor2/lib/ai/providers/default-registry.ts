import { createProviderRegistry, type ProviderRegistry } from "./registry";
import type { AiProvider } from "./types";

// Adapters are code, not configuration (requirements section 5); US-026 adds the two shipped ones here.
export const SHIPPED_PROVIDER_ADAPTERS: readonly AiProvider[] = [];

export function createDefaultProviderRegistry(): ProviderRegistry {
  return createProviderRegistry(SHIPPED_PROVIDER_ADAPTERS);
}
