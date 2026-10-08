import { getDb, type Db } from "../db/index";
import { getAiSettings, type AiSettings } from "../config/ai-settings";
import { isCustomProviderId, listCustomProviders, type CustomProvider } from "../config/custom-providers";
import { createCustomProviderConfigDeps } from "../config/ai-keys";
import { describeLoadError, logLoadError } from "../log/load-error";
import { PROVIDER_CATALOG } from "./provider-catalog";
import {
  getEncryptionKeyMaterial,
  getKeyStatuses,
  readApiKey,
  storingEnabled,
  type KeyEnvironment,
  type ProviderKeyStatus,
} from "./key-status";
import {
  derivePlanSigningKey,
  readStoredProviderKey,
  type StoredProviderKey,
} from "./key-store";
import { createAiSettingsDeps } from "./settings-deps";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import { createOpenAiCompatibleProvider, customChatCompletionsUrl } from "./providers/openai-compatible";
import type { ProviderRegistry } from "./providers/registry";
import { resolveActiveProvider, toAvailability, type ActiveProviderFailureReason, type ActiveProviderResolution, type AiAvailability } from "./providers/resolve";
import type { AiProvider, ProviderCallInput, ProviderFetch } from "./providers/types";

export type ProviderDeps = {
  loadSettings: () => Promise<AiSettings>;
  loadStoredKeys: (customProviders?: readonly CustomProvider[]) => Promise<ReadonlyMap<string, StoredProviderKey>>;
  registry: ProviderRegistry;
  readApiKey: (id: string) => string | null;
  fetch: ProviderFetch;
  loadCustomProviders?: () => Promise<readonly CustomProvider[]>;
};

export type ProviderKeyStatusView = ProviderKeyStatus & { source: "stored" | "environment" | "none"; updatedAt: string | null };

type StoredProviderKeyReader = typeof readStoredProviderKey;

function isMissingProviderKeyTable(error: unknown): boolean {
  return describeLoadError(error).code === "42P01";
}

export async function loadStoredProviderKeys(
  db: Db,
  reader: StoredProviderKeyReader = readStoredProviderKey,
  customProviders: readonly CustomProvider[] = [],
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
  for (const custom of customProviders) {
    try {
      const row = await reader(db, custom.id, undefined, custom.baseUrl);
      if (row !== null) stored.set(custom.id, row);
    } catch (error) {
      if (!isMissingProviderKeyTable(error)) {
        logLoadError(`ai/provider-key/${custom.id}`, error);
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

/** The HMAC key chat.ts signs/verifies a confirmation-plan token with (US-058); `null` = unavailable. */
export function getChatPlanSigningKey(env?: KeyEnvironment): Uint8Array | null {
  return derivePlanSigningKey(getEncryptionKeyMaterial(env));
}

/** Key-free projection of custom providers used by `/admin/ai`; decrypted values stay inside this module. */
export type CustomProviderView = { id: string; name: string; baseUrl: string; keySet: boolean; updatedAt: string | null };

export async function getCustomProviderViews(options?: {
  db?: Db;
  list?: () => Promise<readonly CustomProvider[]>;
  reader?: StoredProviderKeyReader;
}): Promise<{ status: "ok"; providers: readonly CustomProviderView[] } | { status: "error" }> {
  const db = options?.db ?? getDb();
  const list = options?.list ?? (() => listCustomProviders(createCustomProviderConfigDeps(db)));
  const reader = options?.reader ?? readStoredProviderKey;
  try {
    const providers = await list();
    const views: CustomProviderView[] = [];
    for (const provider of providers) {
      let keySet = false;
      let updatedAt: string | null = null;
      try {
        const row = await reader(db, provider.id, undefined, provider.baseUrl);
        if (row !== null) {
          keySet = true;
          updatedAt = row.updatedAt.toISOString();
        }
      } catch (error) {
        if (!isMissingProviderKeyTable(error)) logLoadError(`ai/provider-key/${provider.id}`, error);
      }
      views.push({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, keySet, updatedAt });
    }
    return { status: "ok", providers: views };
  } catch (error) {
    logLoadError("ai/custom-providers", error);
    return { status: "error" };
  }
}

/**
 * The only place that combines settings, the key value, the registry and the global `fetch`
 * (sprint 6 decision 2; DEC-017 §4). `getDb()` runs lazily inside `loadSettings`, never at
 * import time, so the module stays build-safe with `DATABASE_URL` unset.
 */
export function createProviderDeps(): ProviderDeps {
  return {
    loadSettings: () => getAiSettings(createAiSettingsDeps(getDb())),
    loadStoredKeys: (customProviders) => loadStoredProviderKeys(getDb(), readStoredProviderKey, customProviders ?? []),
    registry: createDefaultProviderRegistry(),
    readApiKey,
    fetch: (url, init) => fetch(url, init),
    loadCustomProviders: () => listCustomProviders(createCustomProviderConfigDeps(getDb())),
  };
}

export type ActiveProviderCall =
  | { ok: true; provider: AiProvider; input: ProviderCallInput; providerName: string }
  | { ok: false; reason: ActiveProviderFailureReason };

/** `loadSettings` then `loadStoredKeys`, in that order (PD-8) — a stored key wins over the environment. */
async function resolveFromDeps(
  deps: ProviderDeps,
): Promise<{ resolution: ActiveProviderResolution; custom: CustomProvider | undefined }> {
  const settings = await deps.loadSettings();
  const providerId = settings.provider === null ? "" : settings.provider.trim();
  let custom: CustomProvider | undefined;
  if (isCustomProviderId(providerId) && deps.loadCustomProviders) {
    custom = (await deps.loadCustomProviders()).find((candidate) => candidate.id === providerId);
  }
  const storedKeys = custom ? await deps.loadStoredKeys([custom]) : await deps.loadStoredKeys();
  const customProvider = custom
    ? createOpenAiCompatibleProvider({ id: custom.id, chatCompletionsUrl: customChatCompletionsUrl(custom.baseUrl) })
    : null;
  const resolution = await resolveActiveProvider({
    settings,
    registry: deps.registry,
    readApiKey: (id) => storedKeys.get(id)?.key ?? (isCustomProviderId(id) ? null : deps.readApiKey(id)),
    customProvider,
  });
  return { resolution, custom };
}

/** The provider's display name for the model (custom provider's stored name, else the catalogue name, else the id). */
function providerDisplayName(providerId: string, custom: CustomProvider | undefined): string {
  if (custom !== undefined) return custom.name;
  return PROVIDER_CATALOG.find((p) => p.id === providerId)?.name ?? providerId;
}

/**
 * Key-carrying: the resolution's `apiKey` reaches only `input.apiKey` here, inside `lib/ai/`. A
 * settings-load error propagates to the caller, before any key is read (callers catch it, as
 * `/admin/ai` already does).
 */
export async function loadActiveProvider(deps: ProviderDeps = createProviderDeps()): Promise<ActiveProviderCall> {
  const { resolution, custom } = await resolveFromDeps(deps);
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason };
  }
  return {
    ok: true,
    provider: resolution.provider,
    input: { apiKey: resolution.apiKey, model: resolution.model, fetch: deps.fetch },
    providerName: providerDisplayName(resolution.provider.id, custom),
  };
}

/** Key-free view for `app/` (tech-lead point 5): never carries the resolution object. */
export async function getAiAvailability(deps: ProviderDeps = createProviderDeps()): Promise<AiAvailability> {
  const { resolution } = await resolveFromDeps(deps);
  return toAvailability(resolution);
}
