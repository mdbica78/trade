import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import {
  readStoredProviderKey,
  writeStoredProviderKey,
} from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";
import { createProviderRegistry } from "./providers/registry";
import {
  getAiAvailability,
  getProviderKeyStatusViews,
  loadActiveProvider,
  loadStoredProviderKeys,
  type ProviderDeps,
} from "./provider-deps";

const FAKE_STORED_KEY = "test-key-0000-stored-provider";
const FAKE_ENV_KEY = "test-key-0001-environment-provider";
const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(83) };
let database: EmptyTestDatabase;

beforeEach(async () => {
  database = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await database.close();
});

function providerDeps() {
  const client = pgliteDb(database.pg);
  const readWithFakeMaterial = (db: typeof client, providerId: string) =>
    readStoredProviderKey(db, providerId, (source) => (source === "master" ? MATERIAL : null));
  const deps: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "fake-model" }),
    loadStoredKeys: () => loadStoredProviderKeys(client, readWithFakeMaterial),
    registry: createProviderRegistry([createFakeProvider("gemini")]),
    readApiKey: () => FAKE_ENV_KEY,
    fetch: async () => {
      throw new Error("provider request not expected in key resolution");
    },
  };
  return { client, deps };
}

describe("stored provider-key wiring over PGlite (PD-P)", () => {
  it("PD-P1: decrypts only the selected provider key before synchronous provider resolution", async () => {
    const { client, deps } = providerDeps();
    await writeStoredProviderKey(client, "gemini", FAKE_STORED_KEY, MATERIAL);

    const active = await loadActiveProvider(deps);
    const availability = await getAiAvailability(deps);

    expect(active.ok && active.input.apiKey === FAKE_STORED_KEY).toBe(true);
    expect(availability).toEqual({ available: true, providerId: "gemini", model: "fake-model" });
    expect(JSON.stringify(availability).includes(FAKE_STORED_KEY)).toBe(false);
  }, 60_000);

  it("PD-P2: status projection contains only source/status metadata and falls back to environment for the other provider", async () => {
    const { client } = providerDeps();
    await writeStoredProviderKey(client, "gemini", FAKE_STORED_KEY, MATERIAL);

    const views = await getProviderKeyStatusViews(
      client,
      { GEMINI_API_KEY: undefined, GROQ_API_KEY: FAKE_ENV_KEY },
      (db, providerId) =>
        readStoredProviderKey(db, providerId, (source) => (source === "master" ? MATERIAL : null)),
    );
    const gemini = views.find((row) => row.id === "gemini");
    const groq = views.find((row) => row.id === "groq");

    expect(gemini?.source).toBe("stored");
    expect(gemini?.isSet).toBe(true);
    expect(gemini?.updatedAt !== null).toBe(true);
    expect(groq?.source).toBe("environment");
    expect(groq?.isSet).toBe(true);
    expect(JSON.stringify(views).includes(FAKE_STORED_KEY) || JSON.stringify(views).includes(FAKE_ENV_KEY)).toBe(false);
    expect(Object.keys(gemini ?? {}).sort()).toEqual(
      ["apiKeyEnvVar", "id", "isSet", "name", "requiresApiKey", "source", "updatedAt"].sort(),
    );
  }, 60_000);

  it("PD-P3: a missing table is treated as no stored key and preserves environment fallback", async () => {
    const { client, deps } = providerDeps();
    await database.pg.exec(`drop table "ai_provider_keys"`);
    const read = await loadStoredProviderKeys(client, async (db, providerId) => readStoredProviderKey(
      db,
      providerId,
      (source) => (source === "master" ? MATERIAL : null),
    ));
    const active = await loadActiveProvider({ ...deps, loadStoredKeys: async () => read });

    expect(read.size).toBe(0);
    expect(active.ok && active.input.apiKey === FAKE_ENV_KEY).toBe(true);
  }, 60_000);
});
