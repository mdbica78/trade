import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { readStoredProviderKey, writeStoredProviderKey } from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";

const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(13) };
const FAKE_KEY = "test-key-0000-custom-SENTINEL";
let database: EmptyTestDatabase;

beforeEach(async () => {
  database = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await database.close();
});

describe("key binding over PGlite (KB-P)", () => {
  it("KB-P1: writing for URL A then reading for URL B throws; reading for A returns the fake key", async () => {
    const db = pgliteDb(database.pg);
    await writeStoredProviderKey(db, "custom-1", FAKE_KEY, MATERIAL, undefined, "https://a.example.com/v1");

    await expect(
      readStoredProviderKey(pgliteDb(database.pg), "custom-1", (source) => (source === "master" ? MATERIAL : null), "https://b.example.com/v1"),
    ).rejects.toThrow();

    const row = await readStoredProviderKey(
      pgliteDb(database.pg),
      "custom-1",
      (source) => (source === "master" ? MATERIAL : null),
      "https://a.example.com/v1",
    );
    expect(row !== null && row.key === FAKE_KEY).toBe(true);
  }, 60_000);
});
