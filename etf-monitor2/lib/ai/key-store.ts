import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf } from "../ingestion/store";
import {
  getEncryptionKeyMaterial,
  getEncryptionMaterialForSource,
  type EncryptionKeyMaterial,
  type ProviderKeySource,
} from "./key-status";

export const KEY_DERIVATION_SALT = "etf-monitor2";
export const KEY_DERIVATION_INFO = "ai-provider-keys/v1";
export const PLAN_SIGNING_INFO = "chat-plan/v1";
const PLAN_SIGNING_KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;

export class ProviderKeyStorageDisabledError extends Error {
  constructor() {
    super("Provider key storage is disabled.");
    this.name = "ProviderKeyStorageDisabledError";
  }
}

export class ProviderKeyUnavailableError extends Error {
  constructor() {
    super("Stored provider key is unavailable.");
    this.name = "ProviderKeyUnavailableError";
  }
}

export type EncryptedProviderKey = { ciphertext: string; keySource: ProviderKeySource };
export type StoredProviderKey = {
  key: string;
  keySource: ProviderKeySource;
  updatedAt: Date;
};

/**
 * Derives the HMAC key used to sign a chat confirmation-plan token (US-058, DEC-027 §4), from the
 * same master/cron-derived material as the provider-key encryption (a separate HKDF `info` keeps
 * the two keys independent). `null` material (no `AI_KEY_MASTER_KEY`/no usable `CRON_SECRET`) →
 * `null`: propose/confirm then refuses with `unavailable`. Never logs.
 */
export function derivePlanSigningKey(material: EncryptionKeyMaterial | null): Uint8Array | null {
  if (material === null) return null;
  const inputKeyMaterial = material.source === "master" ? Buffer.from(material.key) : Buffer.from(material.secret, "utf8");
  return new Uint8Array(
    hkdfSync(
      "sha256",
      inputKeyMaterial,
      Buffer.from(KEY_DERIVATION_SALT, "utf8"),
      Buffer.from(PLAN_SIGNING_INFO, "utf8"),
      PLAN_SIGNING_KEY_LENGTH,
    ),
  );
}

export function providerKeyAad(providerId: string, baseUrl: string | null = null): string {
  return baseUrl === null ? providerId : `${providerId}\n${baseUrl}`;
}

export function deriveEncryptionKey(material: EncryptionKeyMaterial): Buffer {
  if (material.source === "master") {
    if (material.key.byteLength !== AES_KEY_LENGTH) throw new ProviderKeyStorageDisabledError();
    return Buffer.from(material.key);
  }
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(material.secret, "utf8"),
      Buffer.from(KEY_DERIVATION_SALT, "utf8"),
      Buffer.from(KEY_DERIVATION_INFO, "utf8"),
      AES_KEY_LENGTH,
    ),
  );
}

export function encryptProviderKeyWithMaterial(
  providerId: string,
  plaintext: string,
  material: EncryptionKeyMaterial,
  makeIv: (size: number) => Uint8Array = randomBytes,
): EncryptedProviderKey {
  const iv = Buffer.from(makeIv(IV_LENGTH));
  if (iv.length !== IV_LENGTH) throw new ProviderKeyStorageDisabledError();
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(material), iv);
  cipher.setAAD(Buffer.from(providerId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  return { ciphertext: packed.toString("base64"), keySource: material.source };
}

export function decryptProviderKeyWithMaterial(
  providerId: string,
  ciphertext: string,
  material: EncryptionKeyMaterial,
): string {
  try {
    const packed = Buffer.from(ciphertext, "base64");
    if (
      packed.length < IV_LENGTH + AUTH_TAG_LENGTH ||
      packed.toString("base64") !== ciphertext
    ) {
      throw new Error();
    }
    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(material), iv);
    decipher.setAAD(Buffer.from(providerId, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new ProviderKeyUnavailableError();
  }
}

export async function writeStoredProviderKey(
  db: Db,
  providerId: string,
  plaintext: string,
  material: EncryptionKeyMaterial | null = getEncryptionKeyMaterial(),
  updatedAt: Date = new Date(),
  baseUrl: string | null = null,
): Promise<void> {
  if (material === null) throw new ProviderKeyStorageDisabledError();
  const encrypted = encryptProviderKeyWithMaterial(providerKeyAad(providerId, baseUrl), plaintext, material);
  await db.execute(
    sql`insert into "ai_provider_keys" ("provider_id", "ciphertext", "key_source", "updated_at")
        values (${providerId}, ${encrypted.ciphertext}, ${encrypted.keySource}, ${updatedAt})
        on conflict ("provider_id") do update set
          "ciphertext" = excluded."ciphertext",
          "key_source" = excluded."key_source",
          "updated_at" = excluded."updated_at"`,
  );
}

export function buildClearStoredProviderKeyStatement(db: Db, providerId: string): ReturnType<Db["execute"]> {
  return db.execute(sql`delete from "ai_provider_keys" where "provider_id" = ${providerId}`);
}

export async function clearStoredProviderKey(db: Db, providerId: string): Promise<void> {
  await buildClearStoredProviderKeyStatement(db, providerId);
}

export async function readStoredProviderKey(
  db: Db,
  providerId: string,
  materialForSource: (source: ProviderKeySource) => EncryptionKeyMaterial | null = getEncryptionMaterialForSource,
  baseUrl: string | null = null,
): Promise<StoredProviderKey | null> {
  const result = await db.execute(
    sql`select "ciphertext", "key_source", "updated_at"
        from "ai_provider_keys" where "provider_id" = ${providerId}`,
  );
  const rows = rowsOf(result);
  if (rows.length === 0) return null;

  const row = rows[0];
  if (
    typeof row.ciphertext !== "string" ||
    (row.key_source !== "master" && row.key_source !== "cron_derived")
  ) {
    throw new ProviderKeyUnavailableError();
  }
  const source = row.key_source;
  const material = materialForSource(source);
  if (material === null || material.source !== source) throw new ProviderKeyUnavailableError();
  const updatedAt = row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at));
  if (!Number.isFinite(updatedAt.getTime())) throw new ProviderKeyUnavailableError();

  return {
    key: decryptProviderKeyWithMaterial(providerKeyAad(providerId, baseUrl), row.ciphertext, material),
    keySource: source,
    updatedAt,
  };
}
