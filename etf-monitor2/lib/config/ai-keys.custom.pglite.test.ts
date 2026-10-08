import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { readStoredProviderKey, writeStoredProviderKey } from "../ai/key-store";
import type { EncryptionKeyMaterial } from "../ai/key-status";
import { createAiKeyConfigDeps, saveProviderKey } from "./ai-keys";

const FAKE_KEY = "test-key-0000-custom-SENTINEL";
const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(71) };
let database: EmptyTestDatabase;

beforeEach(async () => {
  database = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await database.close();
});

describe("custom-provider key configuration over PGlite (AKC-P)", () => {
  it("AKC-P1: a URL-bound write is later read with the same baseUrl", async () => {
    const client = pgliteDb(database.pg);
    const deps = createAiKeyConfigDeps(
      client,
      [{ id: "custom-1", requiresApiKey: true, baseUrl: "https://api.example.com/v1" }],
      true,
      {
        writeEncrypted: (providerId, plaintext, baseUrl) =>
          writeStoredProviderKey(client, providerId, plaintext, MATERIAL, undefined, baseUrl ?? null),
        clearStored: async () => {},
      },
    );
    deps.loadCustomProviders = async () => [{ id: "custom-1", baseUrl: "https://api.example.com/v1" }];

    const result = await saveProviderKey({ providerId: "custom-1", key: FAKE_KEY }, deps);
    expect(result).toEqual({ ok: true });

    const row = await readStoredProviderKey(
      pgliteDb(database.pg),
      "custom-1",
      (source) => (source === "master" ? MATERIAL : null),
      "https://api.example.com/v1",
    );
    expect(row !== null && row.key === FAKE_KEY).toBe(true);
  }, 60_000);
});
