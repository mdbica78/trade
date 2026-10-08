import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";
import { respondWith } from "../../test/helpers/ai-http";
import { seed } from "../db/seed";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import { getAiSettings, setAiSettings } from "../config/ai-settings";
import { addCustomProvider, listCustomProviders } from "../config/custom-providers";
import { createAiKeyConfigDeps, saveProviderKey } from "../config/ai-keys";
import { readStoredProviderKey, writeStoredProviderKey } from "./key-store";
import type { EncryptionKeyMaterial } from "./key-status";
import { loadStoredProviderKeys, type ProviderDeps } from "./provider-deps";
import { handleChatMessage, type ChatDeps } from "./chat";
import { testProviderConnection } from "./connection-test";

const MATERIAL: EncryptionKeyMaterial = { source: "master", key: new Uint8Array(32).fill(91) };
const FAKE_KEY = "test-key-0000-custom-SENTINEL";
let db: EmptyTestDatabase;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
}, 30_000);

afterEach(async () => {
  await db.close();
});

async function makeCustomProvider(baseUrl: string): Promise<string> {
  const added = await addCustomProvider({ name: "Groq via custom", baseUrl }, { db: db.mockDb, run: db.runner });
  if (!added.ok) throw new Error("setup failed");
  return added.id;
}

async function saveKey(id: string, baseUrl: string): Promise<void> {
  const keyStoreDb = pgliteDb(db.pg);
  const deps = createAiKeyConfigDeps(keyStoreDb, [], true, {
    writeEncrypted: (providerId, plaintext, boundUrl) =>
      writeStoredProviderKey(keyStoreDb, providerId, plaintext, MATERIAL, undefined, boundUrl ?? null),
    clearStored: async () => {},
  });
  deps.loadCustomProviders = async () => [{ id, baseUrl }];
  const result = await saveProviderKey({ providerId: id, key: FAKE_KEY }, deps);
  if (!result.ok) throw new Error("key save failed");
}

function providerDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return {
    loadSettings: () => getAiSettings({ db: db.mockDb, run: db.runner }),
    loadStoredKeys: (customs) =>
      loadStoredProviderKeys(
        pgliteDb(db.pg),
        (database, id, _materialForSource, baseUrl) =>
          readStoredProviderKey(database, id, (source) => (source === "master" ? MATERIAL : null), baseUrl),
        customs ?? [],
      ),
    registry: createDefaultProviderRegistry(),
    readApiKey: () => null,
    fetch: fetchSpy,
    loadCustomProviders: () => listCustomProviders({ db: db.mockDb, run: db.runner }),
    ...overrides,
  };
}

function chatDeps(provider: ProviderDeps): ChatDeps {
  return {
    provider,
    config: {
      db: db.mockDb,
      run: db.runner,
      registry: defaultAdapterRegistry,
      detect: vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" }),
      now: () => new Date("2026-10-06T08:00:00Z"),
    },
    widgets: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => new Date("2026-10-06T08:00:00Z") },
  };
}

describe("custom-provider chat end to end over PGlite (CPE)", () => {
  it("CPE-1: add_etf executes through a custom provider, posting once to the configured URL only", async () => {
    const id = await makeCustomProvider("https://llm.example.com/v1");
    await saveKey(id, "https://llm.example.com/v1");
    await setAiSettings({ provider: id, model: "fake-model" }, { db: db.mockDb, run: db.runner, providerIds: [], loadCustomProviderIds: async () => [id] });

    const responseBody = { choices: [{ message: { content: JSON.stringify({ actions: [{ capability: "configuration", action: "add_etf", symbol: "XYZ", name: null }] }) } }] };
    const customFetch = respondWith(200, responseBody);
    const provider = providerDeps({ fetch: customFetch });

    const outcome = await handleChatMessage("add ETF XYZ", () => chatDeps(provider));
    expect(outcome.kind).toBe("executed_actions");
    if (outcome.kind === "executed_actions") {
      expect(outcome.results[0].status).toBe("done");
    }
    const row = await db.pg.query(`select "symbol" from "etfs" where "symbol" = 'XYZ'`);
    expect(row.rows.length).toBe(1);

    expect(customFetch).toHaveBeenCalledTimes(1);
    const [url, init] = customFetch.mock.calls[0];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect((init as RequestInit).redirect).toBe("error");
    expect((init as { headers: Record<string, string> }).headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30_000);

  it("CPE-2: changing the URL makes the old key unusable; chat is unavailable with no request", async () => {
    const id = await makeCustomProvider("https://llm.example.com/v1");
    await saveKey(id, "https://llm.example.com/v1");
    await setAiSettings({ provider: id, model: "fake-model" }, { db: db.mockDb, run: db.runner, providerIds: [], loadCustomProviderIds: async () => [id] });

    const { updateCustomProvider } = await import("../config/custom-providers");
    const { buildClearStoredProviderKeyStatement } = await import("./key-store");
    const updated = await updateCustomProvider(
      { id, name: "Groq via custom", baseUrl: "https://llm.example.com/v2" },
      { db: db.mockDb, run: db.runner, clearKeyStatement: (providerId) => buildClearStoredProviderKeyStatement(db.mockDb, providerId) },
    );
    expect(updated.ok && updated.keyRemoved).toBe(true);

    const noRequestFetch = vi.fn();
    const provider = providerDeps({ fetch: noRequestFetch as never });
    const outcome = await handleChatMessage("add ETF XYZ", () => chatDeps(provider));
    expect(outcome).toEqual({ kind: "unavailable", reason: "no_api_key" });
    expect(noRequestFetch).not.toHaveBeenCalled();
  }, 30_000);

  it("CPE-3: testProviderConnection succeeds once over the custom provider's URL", async () => {
    const id = await makeCustomProvider("https://llm.example.com/v1");
    await saveKey(id, "https://llm.example.com/v1");
    await setAiSettings({ provider: id, model: "fake-model" }, { db: db.mockDb, run: db.runner, providerIds: [], loadCustomProviderIds: async () => [id] });

    const customFetch = respondWith(200, { choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
    const provider = providerDeps({ fetch: customFetch });

    const result = await testProviderConnection(provider);
    expect(result).toEqual({ ok: true });
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(customFetch.mock.calls[0][0]).toBe("https://llm.example.com/v1/chat/completions");
  }, 30_000);

  it("CPE-4: a base_url changed directly in SQL makes the stored key fail AAD; no request, one sanitised log line", async () => {
    const id = await makeCustomProvider("https://llm.example.com/v1");
    await saveKey(id, "https://llm.example.com/v1");
    await setAiSettings({ provider: id, model: "fake-model" }, { db: db.mockDb, run: db.runner, providerIds: [], loadCustomProviderIds: async () => [id] });

    const rowId = Number(id.slice("custom-".length));
    await db.pg.query(`update "ai_custom_providers" set "base_url" = $1 where "id" = $2`, [
      "https://llm.example.com/v2",
      rowId,
    ]);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const noRequestFetch = vi.fn();
    const provider = providerDeps({ fetch: noRequestFetch as never });
    const outcome = await handleChatMessage("add ETF XYZ", () => chatDeps(provider));
    const logged = spy.mock.calls.map((call) => String(call[0]));
    spy.mockRestore();

    expect(outcome).toEqual({ kind: "unavailable", reason: "no_api_key" });
    expect(noRequestFetch).not.toHaveBeenCalled();
    expect(logged.some((line) => line.includes(FAKE_KEY))).toBe(false);
  }, 30_000);
});
