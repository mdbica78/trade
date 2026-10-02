import type { Db } from "../db/index";
import { clearStoredProviderKey, writeStoredProviderKey } from "../ai/key-store";

export type AiKeyProvider = { readonly id: string; readonly requiresApiKey: boolean };
export type AiKeyConfigDeps = {
  providers: readonly AiKeyProvider[];
  storageEnabled: boolean;
  writeEncrypted: (providerId: string, plaintext: string) => Promise<void>;
  clearStored: (providerId: string) => Promise<void>;
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
      operations?.writeEncrypted ?? ((providerId, plaintext) => writeStoredProviderKey(db, providerId, plaintext)),
    clearStored: operations?.clearStored ?? ((providerId) => clearStoredProviderKey(db, providerId)),
  };
}

function findKeyProvider(providerId: unknown, deps: AiKeyConfigDeps): AiKeyProvider | undefined {
  if (typeof providerId !== "string") return undefined;
  const provider = deps.providers.find((candidate) => candidate.id === providerId);
  return provider?.requiresApiKey ? provider : undefined;
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
  const provider = findKeyProvider(input.providerId, deps);
  if (provider === undefined) return { ok: false, error: "unknown_provider" };

  const key = normalizedKey(input.key);
  if (key === null) return { ok: false, error: "key_invalid" };
  if (!deps.storageEnabled) return { ok: false, error: "storing_disabled" };

  try {
    await deps.writeEncrypted(provider.id, key);
    return { ok: true };
  } catch {
    return { ok: false, error: "write_failed" };
  }
}

export async function clearProviderKey(
  providerId: unknown,
  deps: AiKeyConfigDeps,
): Promise<ProviderKeyConfigResult> {
  const provider = findKeyProvider(providerId, deps);
  if (provider === undefined) return { ok: false, error: "unknown_provider" };
  try {
    await deps.clearStored(provider.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "write_failed" };
  }
}
