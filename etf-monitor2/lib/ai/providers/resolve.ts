import type { AiSettings } from "../../config/ai-settings";
import { findProvider } from "../provider-catalog";
import type { ProviderRegistry } from "./registry";
import type { AiProvider } from "./types";

export type ActiveProviderFailureReason = "not_configured" | "unknown_provider" | "not_implemented" | "no_api_key" | "no_model";

export type ActiveProviderResolution =
  | { ok: true; provider: AiProvider; model: string; apiKey: string | null }
  | { ok: false; reason: ActiveProviderFailureReason };

export type AiAvailability =
  | { available: true; providerId: string; model: string }
  | { available: false; reason: ActiveProviderFailureReason };

/**
 * Pure, no I/O, never throws (FR6, FR11). Checks run in this order: not configured, unknown
 * provider (sprint-05 decision 10 — must display as none/unknown, not crash), not implemented,
 * missing key, missing model.
 */
export function resolveActiveProvider(input: {
  settings: AiSettings;
  registry: ProviderRegistry;
  readApiKey: (providerId: string) => string | null;
}): ActiveProviderResolution {
  const { settings, registry, readApiKey } = input;

  const providerId = settings.provider === null ? "" : settings.provider.trim();
  if (providerId === "") {
    return { ok: false, reason: "not_configured" };
  }

  const descriptor = findProvider(providerId);
  if (descriptor === undefined) {
    return { ok: false, reason: "unknown_provider" };
  }

  const provider = registry.get(providerId);
  if (provider === undefined) {
    return { ok: false, reason: "not_implemented" };
  }

  let apiKey: string | null = null;
  if (descriptor.requiresApiKey) {
    try {
      apiKey = readApiKey(providerId);
    } catch {
      return { ok: false, reason: "no_api_key" };
    }
    if (apiKey === null) {
      return { ok: false, reason: "no_api_key" };
    }
  }

  const model = settings.model === null ? "" : settings.model.trim();
  if (model === "") {
    // Sprint 6 decision #4 (NEEDS USER): no default model; the user must choose one (FR6).
    return { ok: false, reason: "no_model" };
  }

  return { ok: true, provider, model, apiKey };
}

/** Built field by field, never by spreading the resolution — a key never reaches this shape. */
export function toAvailability(resolution: ActiveProviderResolution): AiAvailability {
  if (resolution.ok) {
    return { available: true, providerId: resolution.provider.id, model: resolution.model };
  }
  return { available: false, reason: resolution.reason };
}
