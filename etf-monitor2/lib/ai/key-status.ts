import { Buffer } from "node:buffer";
import { findProvider, PROVIDER_CATALOG } from "./provider-catalog";

export type ProviderKeySource = "master" | "cron_derived";
export type EncryptionKeyMaterial =
  | { source: "master"; key: Uint8Array }
  | { source: "cron_derived"; secret: string };
export type KeyEnvironment = Readonly<Record<string, string | undefined>>;

export type ProviderKeyStatus = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  isSet: boolean;
};

function masterKey(env: KeyEnvironment): Uint8Array | null {
  const encoded = env.AI_KEY_MASTER_KEY;
  if (typeof encoded !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== encoded) return null;
  return Uint8Array.from(decoded);
}

function cronSecret(env: KeyEnvironment): string | null {
  const secret = env.CRON_SECRET;
  return typeof secret === "string" && secret.length >= 24 ? secret : null;
}

/** Raw encryption material is consumed only by key-store.ts; never pass it to a view. */
export function getEncryptionKeyMaterial(env: KeyEnvironment = process.env): EncryptionKeyMaterial | null {
  const master = masterKey(env);
  if (master !== null) return { source: "master", key: master };
  const secret = cronSecret(env);
  return secret === null ? null : { source: "cron_derived", secret };
}

/** Resolves only the row's recorded source. It deliberately never falls back to another source. */
export function getEncryptionMaterialForSource(
  source: ProviderKeySource,
  env: KeyEnvironment = process.env,
): EncryptionKeyMaterial | null {
  if (source === "master") {
    const key = masterKey(env);
    return key === null ? null : { source: "master", key };
  }
  const secret = cronSecret(env);
  return secret === null ? null : { source: "cron_derived", secret };
}

export function storingEnabled(env: KeyEnvironment = process.env): boolean {
  return getEncryptionKeyMaterial(env) !== null;
}

/**
 * The only file that reads a provider API key variable. It returns booleans only — never the
 * value — so this must stay the sole importer of `process.env[<key var>]` in the repo (AGENTS.md
 * Secrets, DEC-015). Read at request time (the caller must render dynamically), not at build.
 */
export function getKeyStatuses(env: KeyEnvironment = process.env): ProviderKeyStatus[] {
  return PROVIDER_CATALOG.map((provider) => {
    const value = env[provider.apiKeyEnvVar];
    const isSet = typeof value === "string" && value.trim() !== "";
    return {
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet,
    };
  });
}

/**
 * Reads a provider's key value, trimmed (same rule as `isSet`, so a pasted trailing newline
 * never breaks auth) — never for an arbitrary env var: only a catalogue provider id is accepted.
 * The value goes only into `ProviderCallContext.apiKey` (AGENTS.md Secrets; DEC-015 §1).
 */
export function readApiKey(providerId: string, env: KeyEnvironment = process.env): string | null {
  const descriptor = findProvider(providerId);
  if (descriptor === undefined) {
    return null;
  }
  const value = env[descriptor.apiKeyEnvVar];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
