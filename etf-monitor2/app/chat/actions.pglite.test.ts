import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { seed } from "../../lib/db/seed";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "../../lib/ai/providers/registry";

let db: EmptyTestDatabase;
let fetchSpy: ReturnType<typeof vi.fn>;
let fake: ReturnType<typeof createFakeProvider>;
const detectSpy = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" });

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));

vi.mock("../../lib/db", () => ({ getDb: () => db.mockDb }));
vi.mock("../../lib/db/index", () => ({ getDb: () => db.mockDb }));

vi.mock("../../lib/ingestion/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/ingestion/store")>();
  return { ...original, neonBatchRunner: () => db.runner };
});

vi.mock("../../lib/ai/providers/default-registry", () => ({
  createDefaultProviderRegistry: () => createProviderRegistry([fake]),
}));

vi.mock("../../lib/config/detect-adapter", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/config/detect-adapter")>();
  return { ...original, detectAdapter: (etf: { symbol: string; bvbUrl: string }) => detectSpy(etf) };
});

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
  await db.pg.query('update "settings" set "ai_provider" = $1, "ai_model" = $2 where "id" = 1', ["gemini", "m-1"]);
  vi.stubEnv("GEMINI_API_KEY", "k-test");
  fake = createFakeProvider("gemini", [{ ok: true, text: '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"XYZ","name":null}]}' }]);
  revalidatePathMock.mockClear();
  detectSpy.mockClear();
}, 30_000);

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.close();
});

describe("sendChatMessageAction end to end with default wiring (CAP, AC2)", () => {
  it("CAP-1: add ETF XYZ inserts a row and revalidates every path", async () => {
    const { sendChatMessageAction } = await import("./actions");
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");

    const reply = await sendChatMessageAction(formData);

    expect(reply.messageKey).toBe("addedNoAdapter");
    const rows = (await db.pg.query('select "symbol" from "etfs" where "symbol" = $1', ["XYZ"])).rows;
    expect(rows).toHaveLength(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/etfs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/etfs/XYZ/fields");
    expect(revalidatePathMock).toHaveBeenCalledWith("/etf/XYZ");
  });

  it("CAP-3: an unset API key gives unavailableNoApiKey, no fetch call, database unchanged", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("GEMINI_API_KEY", "");
    const { sendChatMessageAction } = await import("./actions");
    const before = (await db.pg.query('select * from "etfs" order by "id"')).rows;
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");

    const reply = await sendChatMessageAction(formData);

    expect(reply.messageKey).toBe("unavailableNoApiKey");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await db.pg.query('select * from "etfs" order by "id"')).rows).toEqual(before);
  });

  it("CAP-2: the API key reaches the adapter but never the reply", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("GEMINI_API_KEY", "ZQ-KEY-GEM-4471");
    fake = createFakeProvider("gemini", [
      {
        ok: true,
        text: '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"XYZ","name":null}]}',
      },
    ]);
    const { sendChatMessageAction } = await import("./actions");
    const formData = new FormData();
    formData.set("message", "add ETF XYZ");

    const reply = await sendChatMessageAction(formData);

    expect(fake.calls[0]?.ctx.apiKey).toBe("ZQ-KEY-GEM-4471");
    expect(JSON.stringify(reply)).not.toContain("ZQ-KEY");
  });
});
