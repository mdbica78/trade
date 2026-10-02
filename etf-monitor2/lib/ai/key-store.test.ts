import { Buffer } from "node:buffer";
import { hkdfSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptProviderKeyWithMaterial,
  deriveEncryptionKey,
  encryptProviderKeyWithMaterial,
  KEY_DERIVATION_INFO,
  KEY_DERIVATION_SALT,
  ProviderKeyUnavailableError,
} from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";

const FAKE_KEY = "test-key-0000-obvious-fake-material";
const MASTER: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(37) };
const CRON: EncryptionKeyMaterial = { source: "cron_derived", secret: "fake-cron-secret-for-hkdf-tests" };

function isUnavailable(work: () => unknown): boolean {
  try {
    work();
    return false;
  } catch (error) {
    return error instanceof ProviderKeyUnavailableError && error.message === "Stored provider key is unavailable.";
  }
}

describe("provider key encryption (KS)", () => {
  it("KS-1: packs a fresh 12-byte IV, 16-byte authentication tag and encrypted payload, then round-trips", () => {
    const first = encryptProviderKeyWithMaterial("gemini", FAKE_KEY, MASTER);
    const second = encryptProviderKeyWithMaterial("gemini", FAKE_KEY, MASTER);
    const packed = Buffer.from(first.ciphertext, "base64");

    expect(first.keySource).toBe("master");
    expect(packed.length > 12 + 16).toBe(true);
    expect(packed.subarray(0, 12).length).toBe(12);
    expect(packed.subarray(12, 28).length).toBe(16);
    expect(packed.toString("base64") === first.ciphertext).toBe(true);
    expect(first.ciphertext !== second.ciphertext).toBe(true);
    expect(decryptProviderKeyWithMaterial("gemini", first.ciphertext, MASTER) === FAKE_KEY).toBe(true);
    expect(first.ciphertext.includes(FAKE_KEY)).toBe(false);
  });

  it("KS-2: rejects changed ciphertext, authentication tag, provider AAD, and encryption key", () => {
    const encrypted = encryptProviderKeyWithMaterial("gemini", FAKE_KEY, MASTER);
    const packed = Buffer.from(encrypted.ciphertext, "base64");
    const changedPayload = Buffer.from(packed);
    changedPayload[changedPayload.length - 1] ^= 1;
    const changedTag = Buffer.from(packed);
    changedTag[12] ^= 1;

    expect(isUnavailable(() => decryptProviderKeyWithMaterial("gemini", changedPayload.toString("base64"), MASTER))).toBe(true);
    expect(isUnavailable(() => decryptProviderKeyWithMaterial("gemini", changedTag.toString("base64"), MASTER))).toBe(true);
    expect(isUnavailable(() => decryptProviderKeyWithMaterial("groq", encrypted.ciphertext, MASTER))).toBe(true);
    expect(
      isUnavailable(() =>
        decryptProviderKeyWithMaterial("gemini", encrypted.ciphertext, {
          source: "master",
          key: new Uint8Array(32).fill(93),
        }),
      ),
    ).toBe(true);
    expect(isUnavailable(() => decryptProviderKeyWithMaterial("gemini", "malformed-ciphertext", MASTER))).toBe(true);
  });

  it("KS-3: HKDF uses the fixed salt/info and a 32-byte output distinct from the cron input", () => {
    const expected = Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(CRON.secret, "utf8"),
        Buffer.from("etf-monitor2", "utf8"),
        Buffer.from("ai-provider-keys/v1", "utf8"),
        32,
      ),
    );
    const derived = deriveEncryptionKey(CRON);
    expect(KEY_DERIVATION_SALT === "etf-monitor2").toBe(true);
    expect(KEY_DERIVATION_INFO === "ai-provider-keys/v1").toBe(true);
    expect(derived.length).toBe(32);
    expect(derived.equals(expected)).toBe(true);
    expect(derived.equals(Buffer.from(CRON.secret, "utf8"))).toBe(false);
  });

  it("KS-4: row source selects exactly the source material used for encryption", () => {
    const oldCronCiphertext = encryptProviderKeyWithMaterial("groq", FAKE_KEY, CRON);
    expect(oldCronCiphertext.keySource).toBe("cron_derived");
    expect(decryptProviderKeyWithMaterial("groq", oldCronCiphertext.ciphertext, CRON) === FAKE_KEY).toBe(true);
    expect(
      isUnavailable(() =>
        decryptProviderKeyWithMaterial("groq", oldCronCiphertext.ciphertext, {
          source: "master",
          key: MASTER.key,
        }),
      ),
    ).toBe(true);
  });
});
