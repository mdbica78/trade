import type { AdapterRegistry, ExtractionAdapter } from "./types";

/**
 * Builds an immutable registry from a list of adapters. Throws at construction time on a
 * duplicate key, an empty/whitespace-only key, or an adapter whose `fieldKeys` repeats a key
 * (needed so `validateExtractionResult`'s "cover exactly" is well defined).
 */
export function createAdapterRegistry(adapters: readonly ExtractionAdapter[]): AdapterRegistry {
  const frozenList = Object.freeze([...adapters]);
  const map = new Map<string, ExtractionAdapter>();

  for (const adapter of frozenList) {
    if (adapter.key.trim() === "") {
      throw new Error(`Extraction adapter has an empty key (fieldKeys: ${adapter.fieldKeys.join(", ")})`);
    }
    if (map.has(adapter.key)) {
      throw new Error(`Duplicate extraction adapter key "${adapter.key}"`);
    }

    const seenFieldKeys = new Set<string>();
    for (const fieldKey of adapter.fieldKeys) {
      if (seenFieldKeys.has(fieldKey)) {
        throw new Error(`Extraction adapter "${adapter.key}" repeats fieldKey "${fieldKey}"`);
      }
      seenFieldKeys.add(fieldKey);
    }

    map.set(adapter.key, adapter);
  }

  return {
    get(key) {
      if (typeof key !== "string") {
        return undefined;
      }
      return map.get(key);
    },
    list() {
      return frozenList;
    },
    detect(text) {
      const matches = frozenList.filter((adapter) => adapter.canHandle(text));
      return matches.length === 1 ? matches[0] : undefined;
    },
  };
}
