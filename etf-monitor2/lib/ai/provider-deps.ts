import { getDb, type Db } from "../db/index";
import { getAiSettings, type AiSettings } from "../config/ai-settings";
import { describeLoadError, logLoadError } from "../log/load-error";
import { PROVIDER_CATALOG } from "./provider-catalog";
import {
  getKeyStatuses,
  readApiKey,
  storingEnabled,
  type KeyEnvironment,
  type ProviderKeyStatus,
} from "./key-status";
import {
  readStoredProviderKey,
  type StoredProviderKey,
} from "./key-store";
import { createAiSettingsDeps } from "./settings-deps";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import type { ProviderRegistry } from "./providers/registry";
import { resolveActiveProvider, toAvailability, type ActiveProviderFailureReason, type ActiveProviderResolution, type AiAvailability } from "./providers/resolve";
import type { AiProvider, ProviderCallInput, ProviderFetch } from "./providers/types";

export type ProviderDeps = {
  loadSettings: () => Promise<AiSettings>;
  loadStoredKeys: () => Promise<ReadonlyMap<string, StoredProviderKey>>;
  registry: ProviderRegistry;
  readApiKey: (id: string) => string | null;
  fetch: ProviderFetch;
};

export type ProviderKeyStatusView = ProviderKeyStatus & { source: "stored" | "environment" | "none"; updatedAt: string | null };

type StoredProviderKeyReader = typeof readStoredProviderKey;

function isMissingProviderKeyTable(error: unknown): boolean {
  return describeLoadError(error).code === "42P01";
}

export async function loadStoredProviderKeys(
  db: Db,
  reader: StoredProviderKeyReader = readStoredProviderKey,
): Promise<ReadonlyMap<string, StoredProviderKey>> {
  const stored = new Map<string, StoredProviderKey>();
  for (const { id, requiresApiKey } of PROVIDER_CATALOG) {
    if (!requiresApiKey) continue;
    try {
      const row = await reader(db, id);
      if (row !== null) stored.set(id, row);
    } catch (error) {
      if (!isMissingProviderKeyTable(error)) {
        logLoadError(`ai/provider-key/${id}`, error);
      }
    }
  }
  return stored;
}

/** Key-free projection used by `/admin/ai`; decrypted values stay inside this module. */
export async function getProviderKeyStatusViews(
  db?: Db,
  env?: KeyEnvironment,
  reader: StoredProviderKeyReader = readStoredProviderKey,
): Promise<ProviderKeyStatusView[]> {
  const environment = getKeyStatuses(env);
  let stored: ReadonlyMap<string, StoredProviderKey> = new Map();
  try {
    stored = await loadStoredProviderKeys(db ?? getDb(), reader);
  } catch (error) {
    logLoadError("ai/provider-keys", error);
  }

  return environment.map((entry) => {
    const storedKey = stored.get(entry.id);
    const source: ProviderKeyStatusView["source"] =
      storedKey !== undefined ? "stored" : entry.isSet ? "environment" : "none";
    return {
      id: entry.id,
      name: entry.name,
      requiresApiKey: entry.requiresApiKey,
      apiKeyEnvVar: entry.apiKeyEnvVar,
      isSet: source !== "none",
      source,
      updatedAt: storedKey?.updatedAt.toISOString() ?? null,
    };
  });
}

export function getProviderKeyStorageEnabled(): boolean {
  return storingEnabled();
}

/**
 * The only place that combines settings, the key value, the registry and the global `fetch`
 * (sprint 6 decision 2; DEC-017 §4). `getDb()` runs lazily inside `loadSettings`, never at
 * import time, so the module stays build-safe with `DATABASE_URL` unset.
 */
export function createProviderDeps(): ProviderDeps {
  return {
    loadSettings: () => getAiSettings(createAiSettingsDeps(getDb())),
    loadStoredKeys: () => loadStoredProviderKeys(getDb()),
    registry: createDefaultProviderRegistry(),
    readApiKey,
    fetch: (url, init) => fetch(url, init),
  };
}

export type ActiveProviderCall =
  | { ok: true; provider: AiProvider; input: ProviderCallInput }
  | { ok: false; reason: ActiveProviderFailureReason };

/** `loadSettings` then `loadStoredKeys`, in that order (PD-8) — a stored key wins over the environment. */
async function resolveFromDeps(deps: ProviderDeps): Promise<ActiveProviderResolution> {
  const settings = await deps.loadSettings();
  const storedKeys = await deps.loadStoredKeys();
  return resolveActiveProvider({
    settings,
    registry: deps.registry,
    readApiKey: (id) => storedKeys.get(id)?.key ?? deps.readApiKey(id),
  });
}

/**
 * Key-carrying: the resolution's `apiKey` reaches only `input.apiKey` here, inside `lib/ai/`. A
 * settings-load error propagates to the caller, before any key is read (callers catch it, as
 * `/admin/ai` already does).
 */
export async function loadActiveProvider(deps: ProviderDeps = createProviderDeps()): Promise<ActiveProviderCall> {
  const resolution = await resolveFromDeps(deps);
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason };
  }
  return {
    ok: true,
    provider: resolution.provider,
    input: { apiKey: resolution.apiKey, model: resolution.model, fetch: deps.fetch },
  };
}

/** Key-free view for `app/` (tech-lead point 5): never carries the resolution object. */
export async function getAiAvailability(deps: ProviderDeps = createProviderDeps()): Promise<AiAvailability> {
  return toAvailability(await resolveFromDeps(deps));
}
