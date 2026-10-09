import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createHomeTableLoader } from "./home";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

function loader() {
  return createHomeTableLoader(db.mockDb, undefined, db.runner);
}

async function insertReport(etfId: number, sourceUrl: string, fetchedAt: Date | null) {
  await db.pg.query(
    `insert into "reports" ("etf_id", "report_date", "source_url", "fetched_at", "status") values ($1, $2, $3, $4, 'ok')`,
    [etfId, "2026-09-22", sourceUrl, fetchedAt],
  );
}

async function insertLink(etfId: number, sourceUrl: string, discoveredAt: Date) {
  await db.pg.query(
    `insert into "etf_report_links" ("etf_id", "source_url", "discovered_at") values ($1, $2, $3)`,
    [etfId, sourceUrl, discoveredAt],
  );
}

async function setAdapterKey(etfId: number, adapterKey: string | null) {
  await db.pg.query(`update "etfs" set "adapter_key" = $1 where "id" = $2`, [adapterKey, etfId]);
}

describe("US-030 AC4: the home loader's link rule competes etf_report_links against the newest report", () => {
  it("HL-1: link only (no reports) -> the link's URL, adapter unavailable", async () => {
    await setAdapterKey(db.etfId, null);
    await insertLink(db.etfId, "https://bvb.ro/link-only.pdf", new Date("2026-09-27T09:00:00Z"));

    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/link-only.pdf");
    expect(row.adapterAvailable).toBe(false);
  });

  it("HL-2: a report newer than the link -> the report's URL wins", async () => {
    await insertReport(db.etfId, "https://bvb.ro/report.pdf", new Date("2026-09-22T10:00:00Z"));
    await insertLink(db.etfId, "https://bvb.ro/link.pdf", new Date("2026-09-22T09:00:00Z"));

    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/report.pdf");
  });

  it("HL-3: a link newer than the report -> the link's URL wins", async () => {
    await insertReport(db.etfId, "https://bvb.ro/report.pdf", new Date("2026-09-22T10:00:00Z"));
    await insertLink(db.etfId, "https://bvb.ro/link.pdf", new Date("2026-09-22T11:00:00Z"));

    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/link.pdf");
  });

  it("HL-4: a report with a NULL fetched_at counts as older than any link", async () => {
    await insertReport(db.etfId, "https://bvb.ro/report.pdf", null);
    await insertLink(db.etfId, "https://bvb.ro/link.pdf", new Date("2026-09-22T09:00:00Z"));

    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/link.pdf");
  });

  it("HL-5: equal timestamps -> the report wins (strict >)", async () => {
    const t = new Date("2026-09-22T10:00:00Z");
    await insertReport(db.etfId, "https://bvb.ro/report.pdf", t);
    await insertLink(db.etfId, "https://bvb.ro/link.pdf", t);

    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/report.pdf");
  });

  it("HL-6: neither a report nor a link -> null, and latestPdfUrl is never the bvb_url", async () => {
    const row = (await loader()()).rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBeNull();
    for (const r of (await loader()()).rows) {
      if (r.latestPdfUrl !== null) {
        const etfRow = await db.pg.query<{ bvb_url: string }>('select "bvb_url" from "etfs" where "symbol" = $1', [r.symbol]);
        expect(r.latestPdfUrl).not.toBe(etfRow.rows[0].bvb_url);
      }
    }
  });

  it("HL-7: an inactive ETF's link does not produce a row", async () => {
    const inactiveResult = await db.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5) returning "id"`,
      ["INACTIVE", "Inactive fund", "https://bvb.ro/inactive", null, false],
    );
    await insertLink(inactiveResult.rows[0].id, "https://bvb.ro/inactive.pdf", new Date());

    const rows = (await loader()()).rows;
    expect(rows.some((r) => r.symbol === "INACTIVE")).toBe(false);
  });
});
