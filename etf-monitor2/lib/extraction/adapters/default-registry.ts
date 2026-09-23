import { createAdapterRegistry } from "./registry";
import type { ExtractionAdapter } from "./types";

// US-010 adds brd-depositary here; adapters are code, not configuration (requirements section 5).
export const REGISTERED_ADAPTERS: readonly ExtractionAdapter[] = [];

export const defaultAdapterRegistry = createAdapterRegistry(REGISTERED_ADAPTERS);
