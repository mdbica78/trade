import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDrizzleReportStore } from "@/lib/ingestion/store";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../../test/helpers/pglite";
import en from "../../../messages/en.json";

let db: EmptyTestDatabase;

vi.mock("@/lib/db", () => ({ getDb: () => db.mockDb }));
vi.mock("@/lib/admin/operations", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/operations")>();
  return {
    ...original,
    createOperationsLoader: (mockDb: unknown, registry?: unknown) =>
      original.createOperationsLoader(mockDb as Parameters<typeof original.createOperationsLoader>[0], registry as never, db.runner),
  };
});

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
  vi.resetModules();
});

async function insertEtf(symbol: string, adapterKey: string | null) {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
    [symbol, `${symbol} name`, `https://bvb.ro/${symbol}`, adapterKey],
  );
  return result.rows[0].id;
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

async function renderPage() {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("PG-1: operations page rendered against a real PGlite database through the shipped statements", () => {
  it("finds a parse-error message and its value on the page", async () => {
    await insertCatalog("brd-depositary", "net_asset", "Activ net", "Net assets");
    const etfId = await insertEtf("AAA", "brd-depositary");
    const store = createDrizzleReportStore(db.mockDb, db.runner);
    await store.saveReport({
      etfId,
      reportDate: "2026-09-22",
      sourceUrl: "https://bvb.ro/x.pdf",
      fetchedAt: new Date("2026-09-22T09:00:00Z"),
      status: "parse_error",
      errorMessage: "missing fields: nav_per_unit",
      values: [{ fieldKey: "net_asset", numericValue: "415591664.27", rawValue: "415591664.27" }],
    });

    const html = await renderPage();
    expect(html).toContain("missing fields: nav_per_unit");
    expect(html).toContain("Net assets");
    expect(html).toContain("415591664.27");
    expect(html).toContain('href="https://bvb.ro/x.pdf"');
  });
});
