import { getDb } from "../db/index";
import { getAiSettings, type AiSettings } from "../config/ai-settings";
import { readApiKey } from "./key-status";
import { createAiSettingsDeps } from "./settings-deps";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import type { ProviderRegistry } from "./providers/registry";
import { resolveActiveProvider, toAvailability, type ActiveProviderFailureReason, type AiAvailability } from "./providers/resolve";
import type { AiProvider, ProviderCallInput, ProviderFetch } from "./providers/types";

export type ProviderDeps = {
  loadSettings: () => Promise<AiSettings>;
  registry: ProviderRegistry;
  readApiKey: (id: string) => string | null;
  fetch: ProviderFetch;
};

/**
 * The only place that combines settings, the key value, the registry and the global `fetch`
 * (sprint 6 decision 2; DEC-017 §4). `getDb()` runs lazily inside `loadSettings`, never at
 * import time, so the module stays build-safe with `DATABASE_URL` unset.
 */
export function createProviderDeps(): ProviderDeps {
  return {
    loadSettings: () => getAiSettings(createAiSettingsDeps(getDb())),
    registry: createDefaultProviderRegistry(),
    readApiKey,
    fetch: (url, init) => fetch(url, init),
  };
}

export type ActiveProviderCall =
  | { ok: true; provider: AiProvider; input: ProviderCallInput }
  | { ok: false; reason: ActiveProviderFailureReason };

/**
 * Key-carrying: the resolution's `apiKey` reaches only `input.apiKey` here, inside `lib/ai/`. A
 * settings-load error propagates to the caller, before any key is read (callers catch it, as
 * `/admin/ai` already does).
 */
export async function loadActiveProvider(deps: ProviderDeps = createProviderDeps()): Promise<ActiveProviderCall> {
  const settings = await deps.loadSettings();
  const resolution = resolveActiveProvider({ settings, registry: deps.registry, readApiKey: deps.readApiKey });
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
  const settings = await deps.loadSettings();
  const resolution = resolveActiveProvider({ settings, registry: deps.registry, readApiKey: deps.readApiKey });
  return toAvailability(resolution);
}
