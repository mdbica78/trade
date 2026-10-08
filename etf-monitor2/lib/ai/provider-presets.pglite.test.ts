import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { respondWith } from "../../test/helpers/ai-http";
import { PROVIDER_CATALOG } from "./provider-catalog";
import { OPENAI_COMPATIBLE_PRESETS } from "./providers/openai-compatible";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import { runGeneration } from "./providers/run-generation";
import { clearStoredProviderKey, readStoredProviderKey, writeStoredProviderKey } from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";
import { createAiKeyConfigDeps, saveProviderKey } from "../config/ai-keys";
import { getProviderKeyStatusViews, loadActiveProvider, type ProviderDeps } from "./provider-deps";

const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(43) };
let database: EmptyTestDatabase;

beforeEach(async () => {
  database = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await database.close();
});

function configDeps() {
  const client = pgliteDb(database.pg);
  return createAiKeyConfigDeps(client, PROVIDER_CATALOG, true, {
    writeEncrypted: (providerId, plaintext) => writeStoredProviderKey(client, providerId, plaintext, MATERIAL),
    clearStored: (providerId) => clearStoredProviderKey(client, providerId),
  });
}

describe("new preset providers over PGlite (PP)", () => {
  it.each(OPENAI_COMPATIBLE_PRESETS)(
    "PP-1 (%s): a stored key wins over a different env fake in loadActiveProvider, and the adapter request carries it",
    async (preset) => {
      const client = pgliteDb(database.pg);
      const storedKey = `SENTINEL-STORED-PP-${preset.id}`;
      const envKey = `SENTINEL-ENV-PP-${preset.id}`;
      await writeStoredProviderKey(client, preset.id, storedKey, MATERIAL);

      const mock = respondWith(200, { choices: [{ message: { content: "{}" } }] });
      const deps: ProviderDeps = {
        loadSettings: async () => ({ provider: preset.id, model: "preset-test-model" }),
        loadStoredKeys: async () => {
          const row = await readStoredProviderKey(client, preset.id, (source) => (source === "master" ? MATERIAL : null));
          const map = new Map();
          if (row) map.set(preset.id, row);
          return map;
        },
        registry: createDefaultProviderRegistry(),
        readApiKey: () => envKey,
        fetch: mock,
      };
      const call = await loadActiveProvider(deps);
      expect(call.ok).toBe(true);
      if (!call.ok) return;
      expect(call.input.apiKey).toBe(storedKey);
      await runGeneration(call.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call.input);
      const [, init] = mock.mock.calls[0];
      expect(init.headers.authorization).toBe(`Bearer ${storedKey}`);
    },
    60_000,
  );

  it("PP-2: getProviderKeyStatusViews shows source stored for one new preset and environment for the others", async () => {
    const client = pgliteDb(database.pg);
    const target = OPENAI_COMPATIBLE_PRESETS[0];
    await writeStoredProviderKey(client, target.id, "SENTINEL-STORED-PP2", MATERIAL);
    const env = Object.fromEntries(
      PROVIDER_CATALOG.filter((p) => p.id !== target.id).map((p) => [p.apiKeyEnvVar, `SENTINEL-ENV-PP2-${p.id}`]),
    );
    const views = await getProviderKeyStatusViews(client, env, (db, providerId) =>
      readStoredProviderKey(db, providerId, (source) => (source === "master" ? MATERIAL : null)),
    );
    const targetView = views.find((v) => v.id === target.id);
    expect(targetView?.source).toBe("stored");
    for (const preset of OPENAI_COMPATIBLE_PRESETS) {
      if (preset.id === target.id) continue;
      const view = views.find((v) => v.id === preset.id);
      expect(view?.source).toBe("environment");
    }
  }, 60_000);

  it.each(OPENAI_COMPATIBLE_PRESETS)("PP-3 (%s): saveProviderKey accepts the new id through createAiKeyConfigDeps", async (preset) => {
    const result = await saveProviderKey({ providerId: preset.id, key: `test-key-0000-${preset.id}` }, configDeps());
    expect(result).toEqual({ ok: true });
  }, 60_000);
});
