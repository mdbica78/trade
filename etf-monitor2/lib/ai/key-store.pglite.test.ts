import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import {
  clearStoredProviderKey,
  readStoredProviderKey,
  writeStoredProviderKey,
} from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";

const FAKE_KEY = "test-key-0000-pglite-only-value";
const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(51) };
const materialForSource = (source: "master" | "cron_derived") => (source === "master" ? MATERIAL : null);

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

describe("provider key storage against migrated PGlite (KS-P)", () => {
  it("KS-P1: saves and replaces only ciphertext, source and timestamp", async () => {
    const client = pgliteDb(db.pg);
    await writeStoredProviderKey(client, "gemini", FAKE_KEY, MATERIAL, new Date("2026-10-02T12:00:00Z"));
    const first = await readStoredProviderKey(client, "gemini", materialForSource);
    expect(first !== null && first.key === FAKE_KEY).toBe(true);
    expect(first?.keySource).toBe("master");
    expect(first?.updatedAt.toISOString()).toBe("2026-10-02T12:00:00.000Z");

    await writeStoredProviderKey(client, "gemini", "test-key-0001-replacement", MATERIAL, new Date("2026-10-02T13:00:00Z"));
    const replaced = await readStoredProviderKey(client, "gemini", materialForSource);
    expect(replaced !== null && replaced.key === "test-key-0001-replacement").toBe(true);
    expect(replaced?.updatedAt.toISOString()).toBe("2026-10-02T13:00:00.000Z");

    const metadata = await db.pg.query<{
      provider_id: string;
      key_source: string;
      updated_at: Date;
      ciphertext_present: boolean;
    }>(
      `select "provider_id", "key_source", "updated_at", length("ciphertext") > 0 as "ciphertext_present"
       from "ai_provider_keys" where "provider_id" = $1`,
      ["gemini"],
    );
    expect(metadata.rows).toHaveLength(1);
    expect(metadata.rows[0].provider_id).toBe("gemini");
    expect(metadata.rows[0].key_source).toBe("master");
    expect(metadata.rows[0].ciphertext_present).toBe(true);
  }, 60_000);

  it("KS-P2: clear deletes only the selected provider row", async () => {
    const client = pgliteDb(db.pg);
    await writeStoredProviderKey(client, "gemini", FAKE_KEY, MATERIAL);
    await writeStoredProviderKey(client, "groq", "test-key-0002-neighbor", MATERIAL);

    await clearStoredProviderKey(client, "gemini");

    const remaining = await readStoredProviderKey(client, "groq", materialForSource);
    expect(await readStoredProviderKey(client, "gemini", materialForSource)).toBeNull();
    expect(remaining !== null && remaining.key === "test-key-0002-neighbor").toBe(true);
    const count = await db.pg.query<{ count: number }>(`select count(*)::int as "count" from "ai_provider_keys"`);
    expect(count.rows[0].count).toBe(1);
  }, 60_000);
});
