import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

const LINKS = [
  { pdfUrl: "https://x/newest.pdf", title: "decoy", publishedAt: "2026-09-20T00:00" },
  { pdfUrl: "https://x/older.pdf", title: "decoy", publishedAt: "2026-09-19T00:00" },
];

const discoverLatestReport = vi.fn(async () => ({ status: "found" as const, ...LINKS[0], links: LINKS, truncated: false }));
const downloadCalls: string[] = [];
const downloadReportPdf = vi.fn(async (url: string) => {
  downloadCalls.push(url);
  return { ok: true as const, bytes: new TextEncoder().encode(url), fetchedAt: new Date("2026-09-20T09:00:00Z") };
});
const extractPdfText = vi.fn(async (bytes: Uint8Array) => ({ ok: true as const, text: new TextDecoder().decode(bytes) }));

vi.mock("../extraction/discovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extraction/discovery")>();
  return { ...actual, discoverLatestReport };
});
vi.mock("../extraction/pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extraction/pdf")>();
  return { ...actual, downloadReportPdf, extractPdfText };
});

const dateForUrl = new Map([
  [LINKS[0].pdfUrl, "2026-09-20"],
  [LINKS[1].pdfUrl, "2026-09-19"],
]);
const fakeAdapter = {
  key: "brd-depositary",
  fieldKeys: ["nav_per_unit"],
  canHandle: () => true,
  extract: (text: string) => ({
    ok: true as const,
    reportDate: dateForUrl.get(text)!,
    values: [{ fieldKey: "nav_per_unit", numericValue: "1", rawValue: "1" }],
    missingFields: [],
  }),
};
vi.mock("../extraction/adapters/default-registry", () => ({
  defaultAdapterRegistry: { get: () => fakeAdapter, list: () => [fakeAdapter], detect: () => fakeAdapter },
}));

let db: TestDatabase;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
  discoverLatestReport.mockClear();
  downloadReportPdf.mockClear();
  downloadCalls.length = 0;
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.close();
});

describe("createDailyRunDeps wires the run's canStartDownload guard into ingestEtf (US-037 DD-G1)", () => {
  it("canStartDownload always false: only the first link is downloaded", async () => {
    const { createDailyRunDeps } = await import("./default-deps");
    const deps = createDailyRunDeps({ now: () => new Date("2026-09-20T09:00:00Z"), database: { db: db.mockDb, run: db.runner } });

    const outcome = await deps.ingest(
      { id: db.etfId, symbol: "BTBETRETF", bvbUrl: "https://x/page", adapterKey: "brd-depositary", trackedFieldKeys: [] },
      { canStartDownload: () => false },
    );

    expect(downloadCalls).toEqual([LINKS[0].pdfUrl]);
    expect(outcome).toMatchObject({ code: "not_attempted" });
  });

  it("canStartDownload always true: both links are downloaded", async () => {
    const { createDailyRunDeps } = await import("./default-deps");
    const deps = createDailyRunDeps({ now: () => new Date("2026-09-20T09:00:00Z"), database: { db: db.mockDb, run: db.runner } });

    const outcome = await deps.ingest(
      { id: db.etfId, symbol: "BTBETRETF", bvbUrl: "https://x/page", adapterKey: "brd-depositary", trackedFieldKeys: [] },
      { canStartDownload: () => true },
    );

    expect(downloadCalls).toEqual([LINKS[0].pdfUrl, LINKS[1].pdfUrl]);
    expect(outcome).toMatchObject({ code: "ok" });
  });
});
