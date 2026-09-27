import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { seed } from "../../lib/db/seed";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "../../lib/ai/providers/registry";
import { createHomeTableLoader } from "../../lib/monitoring/home";

const REPORT_URL = "https://bvb.ro/infocont/infocont26/XYZ-report.pdf";
const detectSpy = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match", reportUrl: REPORT_URL });
const NOW = new Date("2026-09-27T08:00:00Z");

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));

let dbA: EmptyTestDatabase;
let dbB: EmptyTestDatabase;
let fake: ReturnType<typeof createFakeProvider>;

vi.mock("../../lib/ai/providers/default-registry", () => ({
  createDefaultProviderRegistry: () => createProviderRegistry([fake]),
}));

vi.mock("../../lib/config/detect-adapter", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/config/detect-adapter")>();
  return { ...original, detectAdapter: (etf: { symbol: string; bvbUrl: string }) => detectSpy(etf) };
});

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
  dbA = await createEmptyTestDatabase();
  dbB = await createEmptyTestDatabase();
  await seed(dbA.mockDb, dbA.runner);
  await seed(dbB.mockDb, dbB.runner);
  await dbB.pg.query('update "settings" set "ai_provider" = $1, "ai_model" = $2 where "id" = 1', ["gemini", "m-1"]);
  vi.stubEnv("GEMINI_API_KEY", "k-test");
  fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"add_etf","symbol":"XYZ","name":null}' }]);
  detectSpy.mockClear();
  revalidatePathMock.mockClear();
}, 30_000);

afterEach(async () => {
  vi.unstubAllEnvs();
  await dbA.close();
  await dbB.close();
});

/** Strips generated ids and timestamps so the two databases' rows can be compared byte-for-byte (US-030 AC5). */
function stripGenerated<T extends Record<string, unknown>>(row: T, keys: readonly string[]): Record<string, unknown> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

describe("US-030 AC5: adding a no-adapter ETF gives the same end state via chat as via the form", () => {
  it("AP-1/AP-3: etfs row, etf_report_links row and home-table row match between the form path and the chat path", async () => {
    vi.doMock("../../lib/db", () => ({ getDb: () => dbA.mockDb }));
    vi.doMock("../../lib/db/index", () => ({ getDb: () => dbA.mockDb }));
    vi.doMock("../../lib/ingestion/store", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../lib/ingestion/store")>();
      return { ...original, neonBatchRunner: () => dbA.runner };
    });
    vi.doMock("../../lib/config/default-deps", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../lib/config/default-deps")>();
      return {
        ...original,
        createEtfConfigDeps: (db: unknown) => ({ ...original.createEtfConfigDeps(db as never), detect: detectSpy, now: () => NOW }),
      };
    });
    const { addEtfAction } = await import("../admin/etfs/actions");
    const formData = new FormData();
    formData.set("symbol", "XYZ");
    formData.set("name", "XYZ");
    const formResult = await addEtfAction({ status: "idle" }, formData);
    expect(formResult.status).toBe("success");

    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));
    vi.doMock("../../lib/db", () => ({ getDb: () => dbB.mockDb }));
    vi.doMock("../../lib/db/index", () => ({ getDb: () => dbB.mockDb }));
    vi.doMock("../../lib/ingestion/store", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../lib/ingestion/store")>();
      return { ...original, neonBatchRunner: () => dbB.runner };
    });
    vi.doMock("../../lib/ai/providers/default-registry", () => ({
      createDefaultProviderRegistry: () => createProviderRegistry([fake]),
    }));
    vi.doMock("../../lib/config/detect-adapter", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../lib/config/detect-adapter")>();
      return { ...original, detectAdapter: (etf: { symbol: string; bvbUrl: string }) => detectSpy(etf) };
    });
    vi.doMock("../../lib/config/default-deps", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../lib/config/default-deps")>();
      return {
        ...original,
        createEtfConfigDeps: (db: unknown) => ({ ...original.createEtfConfigDeps(db as never), detect: detectSpy, now: () => NOW }),
      };
    });
    const { sendChatMessageAction } = await import("./actions");
    const chatFormData = new FormData();
    chatFormData.set("message", "add ETF XYZ");
    const chatReply = await sendChatMessageAction(chatFormData);
    expect(chatReply.messageKey).toBe("addedNoAdapter");

    const etfsA = (await dbA.pg.query<{ id: number } & Record<string, unknown>>('select * from "etfs" where "symbol" = $1', ["XYZ"])).rows[0];
    const etfsB = (await dbB.pg.query<{ id: number } & Record<string, unknown>>('select * from "etfs" where "symbol" = $1', ["XYZ"])).rows[0];
    expect(stripGenerated(etfsA, ["id", "created_at"])).toEqual(stripGenerated(etfsB, ["id", "created_at"]));

    const linkA = (await dbA.pg.query<{ source_url: string }>('select "source_url" from "etf_report_links" where "etf_id" = $1', [etfsA.id])).rows[0];
    const linkB = (await dbB.pg.query<{ source_url: string }>('select "source_url" from "etf_report_links" where "etf_id" = $1', [etfsB.id])).rows[0];
    expect(linkA).toEqual(linkB);
    expect(linkA.source_url).toBe(REPORT_URL);

    const homeA = (await createHomeTableLoader(dbA.mockDb, undefined, dbA.runner)()).rows.find((r) => r.symbol === "XYZ");
    const homeB = (await createHomeTableLoader(dbB.mockDb, undefined, dbB.runner)()).rows.find((r) => r.symbol === "XYZ");
    expect(homeA).toEqual(homeB);

    const reportsA = await dbA.pg.query('select * from "reports" where "etf_id" = $1', [etfsA.id]);
    const reportsB = await dbB.pg.query('select * from "reports" where "etf_id" = $1', [etfsB.id]);
    expect(reportsA.rows).toHaveLength(0);
    expect(reportsB.rows).toHaveLength(0);
  }, 30_000);
});
