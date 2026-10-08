import type { Db } from "../db/index";
import { neonBatchRunner } from "../ingestion/store";
import { buildClearStoredProviderKeyStatement, clearStoredProviderKey, writeStoredProviderKey } from "../ai/key-store";
import { isCustomProviderId, type CustomProviderConfigDeps } from "./custom-providers";

export type AiKeyProvider = { readonly id: string; readonly requiresApiKey: boolean; readonly baseUrl?: string };
export type AiKeyConfigDeps = {
  providers: readonly AiKeyProvider[];
  storageEnabled: boolean;
  writeEncrypted: (providerId: string, plaintext: string, baseUrl?: string) => Promise<void>;
  clearStored: (providerId: string) => Promise<void>;
  loadCustomProviders?: () => Promise<readonly { id: string; baseUrl: string }[]>;
};
export type AiKeyStoreOperations = Pick<AiKeyConfigDeps, "writeEncrypted" | "clearStored">;

export type ProviderKeyConfigResult =
  | { ok: true }
  | { ok: false; error: "unknown_provider" | "key_invalid" | "storing_disabled" | "write_failed" };

export function createAiKeyConfigDeps(
  db: Db,
  providers: readonly AiKeyProvider[],
  storageEnabled: boolean,
  operations?: AiKeyStoreOperations,
): AiKeyConfigDeps {
  return {
    providers,
    storageEnabled,
    writeEncrypted:
      operations?.writeEncrypted ??
      ((providerId, plaintext, baseUrl) =>
        writeStoredProviderKey(db, providerId, plaintext, undefined, undefined, baseUrl ?? null)),
    clearStored: operations?.clearStored ?? ((providerId) => clearStoredProviderKey(db, providerId)),
  };
}

/** `lib/config` wiring for the custom-provider config (`lib/config/custom-providers.ts`) that
 * needs the key-store delete statement — the only place the two modules are connected (T-1). */
export function createCustomProviderConfigDeps(db: Db): CustomProviderConfigDeps {
  return {
    db,
    run: neonBatchRunner(db),
    clearKeyStatement: (providerId) => buildClearStoredProviderKeyStatement(db, providerId),
  };
}

async function findKeyProvider(providerId: unknown, deps: AiKeyConfigDeps): Promise<AiKeyProvider | undefined> {
  if (typeof providerId !== "string") return undefined;
  const provider = deps.providers.find((candidate) => candidate.id === providerId);
  if (provider?.requiresApiKey) return provider;
  if (isCustomProviderId(providerId) && deps.loadCustomProviders) {
    const custom = (await deps.loadCustomProviders()).find((candidate) => candidate.id === providerId);
    if (custom) return { id: custom.id, requiresApiKey: true, baseUrl: custom.baseUrl };
  }
  return undefined;
}

function normalizedKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 512 || /[\s\p{Cc}]/u.test(trimmed)) return null;
  return trimmed;
}

export async function saveProviderKey(
  input: { providerId: unknown; key: unknown },
  deps: AiKeyConfigDeps,
): Promise<ProviderKeyConfigResult> {
  const provider = await findKeyProvider(input.providerId, deps);
  if (provider === undefined) return { ok: false, error: "unknown_provider" };

  const key = normalizedKey(input.key);
  if (key === null) return { ok: false, error: "key_invalid" };
  if (!deps.storageEnabled) return { ok: false, error: "storing_disabled" };

  try {
    if (provider.baseUrl !== undefined) {
      await deps.writeEncrypted(provider.id, key, provider.baseUrl);
    } else {
      await deps.writeEncrypted(provider.id, key);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "write_failed" };
  }
}

export async function clearProviderKey(
  providerId: unknown,
  deps: AiKeyConfigDeps,
): Promise<ProviderKeyConfigResult> {
  const provider = await findKeyProvider(providerId, deps);
  if (provider === undefined) return { ok: false, error: "unknown_provider" };
  try {
    await deps.clearStored(provider.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "write_failed" };
  }
}
