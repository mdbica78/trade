import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEncryptionKeyMaterial,
  getEncryptionMaterialForSource,
  getKeyStatuses,
  readApiKey,
  storingEnabled,
} from "./key-status";
import { PROVIDER_CATALOG } from "./provider-catalog";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getKeyStatuses (KS)", () => {
  it("KS-1: one entry per catalogue provider, in order, isSet true when set, never leaks the value", () => {
    const env = Object.fromEntries(PROVIDER_CATALOG.map((provider) => [provider.apiKeyEnvVar, `SENTINEL-${provider.id}-9f3c`]));
    const result = getKeyStatuses(env);
    expect(result.map((r) => r.id)).toEqual(PROVIDER_CATALOG.map((p) => p.id));
    for (const entry of result) {
      expect(entry.isSet).toBe(true);
      expect(typeof entry.isSet).toBe("boolean");
      expect(Object.keys(entry).sort()).toEqual(["apiKeyEnvVar", "id", "isSet", "name", "requiresApiKey"].sort());
    }
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });

  it("KS-2: blank or unset variables are isSet: false", () => {
    const blanks = ["", "   ", undefined];
    const env = Object.fromEntries(PROVIDER_CATALOG.map((provider, index) => [provider.apiKeyEnvVar, blanks[index % blanks.length]]));
    const result = getKeyStatuses(env);
    for (const entry of result) {
      expect(entry.isSet).toBe(false);
    }
  });

  it("KS-3: readApiKey returns each provider's own sentinel, and no other provider's", () => {
    const env = Object.fromEntries(PROVIDER_CATALOG.map((provider) => [provider.apiKeyEnvVar, `SENTINEL-${provider.id.toUpperCase()}-7d1e`]));
    for (const provider of PROVIDER_CATALOG) {
      expect(readApiKey(provider.id, env) === `SENTINEL-${provider.id.toUpperCase()}-7d1e`).toBe(true);
    }
    const other = PROVIDER_CATALOG[1];
    expect(readApiKey(PROVIDER_CATALOG[0].id, env) !== readApiKey(other.id, env)).toBe(true);
  });

  it("KS-4: unset, empty and blank give null; a value is trimmed", () => {
    expect(readApiKey("gemini", {})).toBeNull();
    expect(readApiKey("gemini", { GEMINI_API_KEY: "" })).toBeNull();
    expect(readApiKey("gemini", { GEMINI_API_KEY: "   " })).toBeNull();
    expect(readApiKey("gemini", { GEMINI_API_KEY: "  SENTINEL-X \n" }) === "SENTINEL-X").toBe(true);
  });

  it("KS-5: only a catalogue provider id is accepted, never an arbitrary env var name", () => {
    expect(readApiKey("foo", { PATH: "fake" })).toBeNull();
    expect(readApiKey("PATH", { PATH: "fake" })).toBeNull();
    expect(readApiKey("GEMINI_API_KEY", { GEMINI_API_KEY: "fake" })).toBeNull();
  });

  it("KS-6: a valid master key takes precedence, while invalid base64 falls back to cron derivation", () => {
    const encodedMaster = Buffer.alloc(32, 29).toString("base64");
    const masterEnv = { AI_KEY_MASTER_KEY: encodedMaster, CRON_SECRET: "fake-cron-secret-value-at-least-24" };
    const selected = getEncryptionKeyMaterial(masterEnv);
    expect(selected?.source).toBe("master");
    expect(selected?.source === "master" && selected.key.byteLength === 32).toBe(true);

    const fallback = getEncryptionKeyMaterial({
      AI_KEY_MASTER_KEY: "not-valid-base64",
      CRON_SECRET: "fake-cron-secret-value-at-least-24",
    });
    expect(fallback?.source).toBe("cron_derived");
  });

  it("KS-7: invalid or absent material disables storage; short cron values are not used", () => {
    expect(storingEnabled({})).toBe(false);
    expect(storingEnabled({ AI_KEY_MASTER_KEY: "short", CRON_SECRET: "short" })).toBe(false);
    expect(storingEnabled({ CRON_SECRET: "fake-cron-secret-value-at-least-24" })).toBe(true);
  });

  it("KS-8: decryption material is source-specific when a master key is later added or a source rotates", () => {
    const oldCron = "fake-cron-secret-before-rotation";
    const master = Buffer.alloc(32, 41).toString("base64");
    const sourceMaterial = getEncryptionMaterialForSource("cron_derived", {
      AI_KEY_MASTER_KEY: master,
      CRON_SECRET: oldCron,
    });
    expect(sourceMaterial?.source).toBe("cron_derived");
    expect(sourceMaterial?.source === "cron_derived" && sourceMaterial.secret === oldCron).toBe(true);
    expect(
      getEncryptionMaterialForSource("master", { CRON_SECRET: "fake-cron-secret-value-at-least-24" }),
    ).toBeNull();
    expect(
      getEncryptionMaterialForSource("cron_derived", { CRON_SECRET: "fake-cron-secret-after-rotation" })?.source,
    ).toBe("cron_derived");
    expect(getEncryptionMaterialForSource("cron_derived", { CRON_SECRET: "short" })).toBeNull();
  });
});
