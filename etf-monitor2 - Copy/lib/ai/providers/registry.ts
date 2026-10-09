import { findProvider } from "../provider-catalog";
import type { AiProvider } from "./types";

export interface ProviderRegistry {
  get(id: string): AiProvider | undefined;
  list(): readonly AiProvider[];
}

/**
 * Construction rejects a duplicate id or an id not in `PROVIDER_CATALOG` — a programming error,
 * so it throws rather than returning a result (FR6; sprint-05 decision 10).
 */
export function createProviderRegistry(adapters: readonly AiProvider[]): ProviderRegistry {
  const map = new Map<string, AiProvider>();
  for (const adapter of adapters) {
    if (map.has(adapter.id)) {
      throw new Error("duplicate provider id");
    }
    if (findProvider(adapter.id) === undefined) {
      throw new Error("provider id not in catalogue");
    }
    map.set(adapter.id, adapter);
  }
  const ordered = [...adapters];

  return {
    get(id) {
      return map.get(id);
    },
    list() {
      return [...ordered];
    },
  };
}
