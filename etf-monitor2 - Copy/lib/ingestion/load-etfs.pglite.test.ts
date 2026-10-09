import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createDrizzleEtfLoader } from "./load-etfs";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

describe("createDrizzleEtfLoader executed on PGlite", () => {
  it(
    "LP-2b: orders tracked fields by display_order then field_key, includes a no-tracked-fields ETF, excludes inactive",
    async () => {
      await db.pg.query(
        `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3), ($1, $4, $5), ($1, $6, $3)`,
        [db.etfId, "nav_per_unit", 1, "units_in_circulation", 0, "net_asset"],
      );

      const aaaInsert = await db.pg.query<{ id: number }>(
        `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, $4, $5) returning "id"`,
        ["AAAETF", "AAA ETF", "https://bvb.ro/AAAETF", null, true],
      );

      await db.pg.query(
        `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, $4, $5)`,
        ["ZZZETF", "ZZZ ETF (inactive)", "https://bvb.ro/ZZZETF", "brd-depositary", false],
      );
      const zzzId = (
        await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', ["ZZZETF"])
      ).rows[0].id;
      await db.pg.query(
        `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
        [zzzId, "net_asset", 0],
      );

      const loader = createDrizzleEtfLoader(db.mockDb, db.runner);
      const result = await loader();

      expect(result).toEqual([
        {
          id: aaaInsert.rows[0].id,
          symbol: "AAAETF",
          bvbUrl: "https://bvb.ro/AAAETF",
          adapterKey: null,
          isActive: true,
          trackedFieldKeys: [],
        },
        {
          id: db.etfId,
          symbol: "BTBETRETF",
          bvbUrl: "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF",
          adapterKey: "brd-depositary",
          isActive: true,
          trackedFieldKeys: ["units_in_circulation", "nav_per_unit", "net_asset"],
        },
      ]);
    },
    30_000,
  );
});
