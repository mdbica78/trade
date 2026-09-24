import { brdDepositaryAdapter } from "./brd-depositary";
import { createAdapterRegistry } from "./registry";
import type { ExtractionAdapter } from "./types";

// Adapters are code, not configuration (requirements section 5); add new adapters here.
export const REGISTERED_ADAPTERS: readonly ExtractionAdapter[] = [brdDepositaryAdapter];

export const defaultAdapterRegistry = createAdapterRegistry(REGISTERED_ADAPTERS);
