import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import type { DailyEtf } from "./run-daily";
import { neonBatchRunner, rowsOf, type BatchRunner } from "./store";

/**
 * Active ETFs with their tracked field keys, ordered by `display_order` then `field_key`
 * (US-012 story Task 1 "deterministic tie-break"). Inactive ETFs are filtered out in SQL;
 * `runDailyIngestion` also skips any that slip through, so the tests prove real behaviour.
 */
export function buildLoadActiveEtfsStatement(db: Db) {
  return db.execute(
    sql`select "e"."id", "e"."symbol", "e"."bvb_url", "e"."adapter_key", "e"."is_active", "t"."field_key"
        from "etfs" "e" left join "tracked_fields" "t" on "t"."etf_id" = "e"."id"
        where "e"."is_active" = true
        order by "e"."symbol", "e"."id", "t"."display_order", "t"."field_key"`,
  );
}

export function parsePgBoolean(value: unknown): boolean {
  if (value === true || value === "t" || value === "true") return true;
  if (value === false || value === "f" || value === "false") return false;
  throw new Error(`unexpected boolean value from is_active: ${JSON.stringify(value)}`);
}

export function createDrizzleEtfLoader(db: Db, run: BatchRunner = neonBatchRunner(db)): () => Promise<DailyEtf[]> {
  return async () => {
    const [result] = await run([buildLoadActiveEtfsStatement(db)]);
    const rows = rowsOf(result);

    const byId = new Map<number, DailyEtf>();
    const order: number[] = [];

    for (const row of rows) {
      const id = Number(row.id);
      let etf = byId.get(id);
      if (!etf) {
        etf = {
          id,
          symbol: String(row.symbol),
          bvbUrl: String(row.bvb_url),
          adapterKey: row.adapter_key === null ? null : String(row.adapter_key),
          isActive: parsePgBoolean(row.is_active),
          trackedFieldKeys: [],
        };
        byId.set(id, etf);
        order.push(id);
      }
      if (row.field_key !== null && row.field_key !== undefined) {
        (etf.trackedFieldKeys as string[]).push(String(row.field_key));
      }
    }

    return order.map((id) => byId.get(id)!);
  };
}
