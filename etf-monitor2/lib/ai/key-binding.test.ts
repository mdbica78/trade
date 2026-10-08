import { describe, expect, it } from "vitest";
import {
  decryptProviderKeyWithMaterial,
  encryptProviderKeyWithMaterial,
  providerKeyAad,
  ProviderKeyUnavailableError,
} from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";

const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(13) };
const FAKE_KEY = "test-key-0000-custom-SENTINEL";

describe("providerKeyAad / key binding (KB)", () => {
  it("KB-1: a null baseUrl gives the AAD byte-identical to the provider id (old preset ciphertexts still decrypt)", () => {
    expect(providerKeyAad("gemini", null)).toBe("gemini");
    expect(providerKeyAad("gemini")).toBe("gemini");
  });

  it("KB-2: a key encrypted for URL A fails to decrypt for URL B", () => {
    const encrypted = encryptProviderKeyWithMaterial(
      providerKeyAad("custom-1", "https://a.example.com/v1"),
      FAKE_KEY,
      MATERIAL,
    );
    expect(() =>
      decryptProviderKeyWithMaterial(providerKeyAad("custom-1", "https://b.example.com/v1"), encrypted.ciphertext, MATERIAL),
    ).toThrow(ProviderKeyUnavailableError);
  });

  it("KB-3: the same URL round-trips", () => {
    const encrypted = encryptProviderKeyWithMaterial(
      providerKeyAad("custom-1", "https://a.example.com/v1"),
      FAKE_KEY,
      MATERIAL,
    );
    const decrypted = decryptProviderKeyWithMaterial(
      providerKeyAad("custom-1", "https://a.example.com/v1"),
      encrypted.ciphertext,
      MATERIAL,
    );
    expect(decrypted).toBe(FAKE_KEY);
  });

  it("KB-4: a preset AAD never equals any custom AAD for the same id", () => {
    const presetAad = providerKeyAad("custom-1", null);
    const customAad = providerKeyAad("custom-1", "https://a.example.com/v1");
    expect(presetAad).not.toBe(customAad);

    const encryptedPreset = encryptProviderKeyWithMaterial(presetAad, FAKE_KEY, MATERIAL);
    expect(() => decryptProviderKeyWithMaterial(customAad, encryptedPreset.ciphertext, MATERIAL)).toThrow(
      ProviderKeyUnavailableError,
    );
  });
});
