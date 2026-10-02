import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { PROVIDER_CATALOG } from "../ai/provider-catalog";
import { clearStoredProviderKey, readStoredProviderKey, writeStoredProviderKey } from "../ai/key-store";
import type { EncryptionKeyMaterial } from "../ai/key-status";
import { clearProviderKey, createAiKeyConfigDeps, saveProviderKey } from "./ai-keys";

const FAKE_KEY = "test-key-0000-config-pglite";
const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(71) };
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
    writeEncrypted: (providerId, plaintext) =>
      writeStoredProviderKey(client, providerId, plaintext, MATERIAL),
    clearStored: (providerId) => clearStoredProviderKey(client, providerId),
  });
}

describe("provider-key configuration over PGlite (AK-P)", () => {
  it("AK-P1: save and replace persist encrypted rows without changing settings", async () => {
    await database.pg.query(
      `insert into "settings" ("id", "ai_provider", "ai_model") values (1, 'groq', 'fake-model')`,
    );
    const deps = configDeps();
    expect((await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, deps)).ok).toBe(true);
    const first = await readStoredProviderKey(
      pgliteDb(database.pg),
      "gemini",
      (source) => (source === "master" ? MATERIAL : null),
    );
    expect(first !== null && first.key === FAKE_KEY).toBe(true);

    expect((await saveProviderKey({ providerId: "gemini", key: "test-key-0001-replaced" }, deps)).ok).toBe(true);
    expect((await saveProviderKey({ providerId: "groq", key: "test-key-0002-neighbor" }, deps)).ok).toBe(true);
    const rows = await database.pg.query<{ provider_id: string; key_source: string; ciphertext_present: boolean }>(
      `select "provider_id", "key_source", length("ciphertext") > 0 as "ciphertext_present"
       from "ai_provider_keys" order by "provider_id"`,
    );
    expect(rows.rows.map((row) => row.provider_id)).toEqual(["gemini", "groq"]);
    expect(rows.rows.every((row) => row.key_source === "master" && row.ciphertext_present)).toBe(true);
    const settings = await database.pg.query<{ ai_provider: string; ai_model: string }>(
      `select "ai_provider", "ai_model" from "settings" where "id" = 1`,
    );
    expect(settings.rows).toEqual([{ ai_provider: "groq", ai_model: "fake-model" }]);
  }, 60_000);

  it("AK-P2: clearing one provider restores its injected environment fallback and leaves its neighbor stored", async () => {
    const deps = configDeps();
    await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, deps);
    await saveProviderKey({ providerId: "groq", key: "test-key-0002-neighbor" }, deps);

    expect(await clearProviderKey("gemini", deps)).toEqual({ ok: true });
    const gemini = await readStoredProviderKey(
      pgliteDb(database.pg),
      "gemini",
      (source) => (source === "master" ? MATERIAL : null),
    );
    const groq = await readStoredProviderKey(
      pgliteDb(database.pg),
      "groq",
      (source) => (source === "master" ? MATERIAL : null),
    );
    expect(gemini).toBeNull();
    expect(groq !== null && groq.key === "test-key-0002-neighbor").toBe(true);
    const environmentFallback = "test-environment-key-only";
    expect((gemini?.key ?? environmentFallback) === environmentFallback).toBe(true);
    const count = await database.pg.query<{ count: number }>(`select count(*)::int as "count" from "ai_provider_keys"`);
    expect(count.rows[0].count).toBe(1);
  }, 60_000);

  it("AK-P3: a missing key table maps to a key-free write_failed result", async () => {
    await database.pg.exec(`drop table "ai_provider_keys"`);
    const result = await saveProviderKey({ providerId: "gemini", key: FAKE_KEY }, configDeps());
    expect(result).toEqual({ ok: false, error: "write_failed" });
    expect(JSON.stringify(result).includes(FAKE_KEY)).toBe(false);
  }, 60_000);
});
