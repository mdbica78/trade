import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { buildClearStoredProviderKeyStatement, readStoredProviderKey, writeStoredProviderKey } from "../ai/key-store";
import type { EncryptionKeyMaterial } from "../ai/key-status";
import {
  CUSTOM_PROVIDER_MAX,
  addCustomProvider,
  deleteCustomProvider,
  listCustomProviders,
  updateCustomProvider,
  type CustomProviderConfigDeps,
} from "./custom-providers";

const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(57) };
const FAKE_KEY = "test-key-0000-custom-SENTINEL";
let database: EmptyTestDatabase;

beforeEach(async () => {
  database = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await database.close();
});

function configDeps(): CustomProviderConfigDeps {
  const db = pgliteDb(database.pg);
  return {
    db,
    run: database.runner,
    clearKeyStatement: (providerId) => buildClearStoredProviderKeyStatement(db, providerId),
  };
}

describe("custom providers over PGlite (CPP)", () => {
  it("CPP-1: add then list, in id order, with normalised URLs", async () => {
    const deps = configDeps();
    const a = await addCustomProvider({ name: "Groq via custom", baseUrl: "https://api.groq.com/openai/v1" }, deps);
    const b = await addCustomProvider({ name: "Local Mix", baseUrl: "https://API.Example.com:443/v1//" }, deps);
    expect(a.ok && b.ok).toBe(true);
    const list = await listCustomProviders(deps);
    expect(list.map((p) => p.id)).toEqual(["custom-1", "custom-2"]);
    expect(list[1].baseUrl).toBe("https://api.example.com/v1");
  }, 60_000);

  it("CPP-2: the 6th add is refused and the count stays 5; after a delete, an add succeeds", async () => {
    const deps = configDeps();
    for (let i = 0; i < CUSTOM_PROVIDER_MAX; i += 1) {
      const result = await addCustomProvider({ name: `P${i}`, baseUrl: `https://api${i}.example.com/v1` }, deps);
      expect(result.ok).toBe(true);
    }
    const sixth = await addCustomProvider({ name: "P5", baseUrl: "https://api5.example.com/v1" }, deps);
    expect(sixth).toEqual({ ok: false, error: "limit_reached" });
    expect((await listCustomProviders(deps)).length).toBe(CUSTOM_PROVIDER_MAX);

    const deleted = await deleteCustomProvider("custom-1", deps);
    expect(deleted.ok).toBe(true);
    const afterDelete = await addCustomProvider({ name: "P5", baseUrl: "https://api5.example.com/v1" }, deps);
    expect(afterDelete.ok).toBe(true);
  }, 60_000);

  it("CPP-3: a URL change deletes the key row", async () => {
    const deps = configDeps();
    const added = await addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, deps);
    if (!added.ok) throw new Error("setup failed");
    await writeStoredProviderKey(deps.db, added.id, FAKE_KEY, MATERIAL, undefined, "https://api.groq.com/openai/v1");

    const updated = await updateCustomProvider(
      { id: added.id, name: "Groq", baseUrl: "https://api.groq.com/openai/v2" },
      deps,
    );
    expect(updated).toEqual({ ok: true, id: added.id, keyRemoved: true });
    const row = await readStoredProviderKey(
      deps.db,
      added.id,
      (source) => (source === "master" ? MATERIAL : null),
      "https://api.groq.com/openai/v2",
    );
    expect(row).toBeNull();
    const list = await listCustomProviders(deps);
    expect(list[0].baseUrl).toBe("https://api.groq.com/openai/v2");
  }, 60_000);

  it("CPP-4: atomic rollback when a failing statement is appended to the batch", async () => {
    const atomicDeps = configDeps();
    const added = await addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, atomicDeps);
    if (!added.ok) throw new Error("setup failed");
    await writeStoredProviderKey(atomicDeps.db, added.id, FAKE_KEY, MATERIAL, undefined, "https://api.groq.com/openai/v1");

    const db = pgliteDb(database.pg);
    const failingDeps: CustomProviderConfigDeps = {
      db,
      run: (statements) =>
        database.runner([...statements, db.execute(sql`select * from "no_such_table_at_all"`)]),
      clearKeyStatement: (providerId) => buildClearStoredProviderKeyStatement(db, providerId),
    };

    await expect(
      updateCustomProvider({ id: added.id, name: "Groq", baseUrl: "https://api.groq.com/openai/v2" }, failingDeps),
    ).rejects.toThrow();

    const list = await listCustomProviders(atomicDeps);
    expect(list[0].baseUrl).toBe("https://api.groq.com/openai/v1");
    const row = await readStoredProviderKey(
      atomicDeps.db,
      added.id,
      (source) => (source === "master" ? MATERIAL : null),
      "https://api.groq.com/openai/v1",
    );
    expect(row !== null && row.key === FAKE_KEY).toBe(true);
  }, 60_000);

  it("CPP-5: a name-only edit keeps the key, which still decrypts", async () => {
    const deps = configDeps();
    const added = await addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, deps);
    if (!added.ok) throw new Error("setup failed");
    await writeStoredProviderKey(deps.db, added.id, FAKE_KEY, MATERIAL, undefined, "https://api.groq.com/openai/v1");

    const updated = await updateCustomProvider(
      { id: added.id, name: "Groq (renamed)", baseUrl: "https://api.groq.com/openai/v1" },
      deps,
    );
    expect(updated).toEqual({ ok: true, id: added.id, keyRemoved: false });
    const row = await readStoredProviderKey(
      deps.db,
      added.id,
      (source) => (source === "master" ? MATERIAL : null),
      "https://api.groq.com/openai/v1",
    );
    expect(row !== null && row.key === FAKE_KEY).toBe(true);
  }, 60_000);

  it("CPP-6: delete removes the row and the key together", async () => {
    const deps = configDeps();
    const added = await addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, deps);
    if (!added.ok) throw new Error("setup failed");
    await writeStoredProviderKey(deps.db, added.id, FAKE_KEY, MATERIAL, undefined, "https://api.groq.com/openai/v1");

    const deleted = await deleteCustomProvider(added.id, deps);
    expect(deleted).toEqual({ ok: true, id: added.id, keyRemoved: true });
    expect(await listCustomProviders(deps)).toEqual([]);
    const row = await readStoredProviderKey(
      deps.db,
      added.id,
      (source) => (source === "master" ? MATERIAL : null),
      "https://api.groq.com/openai/v1",
    );
    expect(row).toBeNull();
  }, 60_000);

  it("CPP-7: a dropped table makes listCustomProviders return [] and addCustomProvider reject", async () => {
    await database.pg.exec(`drop table "ai_custom_providers"`);
    const deps = configDeps();
    expect(await listCustomProviders(deps)).toEqual([]);
    await expect(addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, deps)).rejects.toThrow();
  }, 60_000);

  it("CPP-8: a row with base_url set by hand to a private host is not listed", async () => {
    const deps = configDeps();
    await database.pg.query(`insert into "ai_custom_providers" ("name", "base_url") values ($1, $2)`, [
      "Sneaky",
      "https://localhost/v1",
    ]);
    expect(await listCustomProviders(deps)).toEqual([]);
  }, 60_000);

  it("CPP-9: update/delete of an unknown id returns not_found and leaves other rows untouched", async () => {
    const deps = configDeps();
    const added = await addCustomProvider({ name: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, deps);
    if (!added.ok) throw new Error("setup failed");

    expect(
      await updateCustomProvider({ id: "custom-999999", name: "X", baseUrl: "https://x.example.com" }, deps),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await deleteCustomProvider("custom-999999", deps)).toEqual({ ok: false, error: "not_found" });

    const list = await listCustomProviders(deps);
    expect(list.map((p) => p.id)).toEqual([added.id]);
  }, 60_000);
});
