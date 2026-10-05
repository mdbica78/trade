import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { rowsOf } from "./ingestion/store";
import { logLoadError } from "./log/load-error";

export type HealthStatus =
  | {
      dbConnected: true;
      etfCount: number;
      fieldCatalogCount: number;
      schema: { missingTables: readonly string[] };
    }
  | { dbConnected: false; error: string }
  | { dbConnected: false; timedOut: true };

/**
 * Well under Vercel's default 10s duration for a Hobby function with no `maxDuration` set
 * (`/health` sets none), and above a Neon free-tier cold start after its ~5 min sleep
 * (requirements §4), which takes a few seconds (US-031 plan section 4, risk R6).
 */
export const HEALTH_QUERY_TIMEOUT_MS = 8_000;

/** Every table the current schema declares, derived so the schema-drift check (DEC-019 §2) never needs a hand-kept list. */
export function schemaTableNames(schemaModule: Record<string, unknown>): string[] {
  return Object.values(schemaModule)
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableName(table))
    .sort();
}

/**
 * One statement, one round trip — never names a table literally, so it stays outside
 * `lib/ingestion/boundaries.test.ts` BD-16's literal-table-name scan.
 */
export function buildHealthStatement(db: Db, tables: readonly string[]) {
  return db.execute(
    sql`select
          (select count(*) from "etfs")::int as "etf_count",
          (select count(*) from "field_catalog")::int as "field_catalog_count",
          (select string_agg("t"."name", ',' order by "t"."name")
             from unnest(string_to_array(${tables.join(",")}::text, ',')) as "t"("name")
             where to_regclass('public.' || "t"."name") is null) as "missing"`,
  );
}

export async function getHealthStatus(db: Db, options: { tables?: readonly string[] } = {}): Promise<HealthStatus> {
  const tables = options.tables ?? schemaTableNames(schema);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = buildHealthStatement(db, tables);
    // A late rejection past the timeout is swallowed here, not left unhandled or awaited again.
    query.catch(() => undefined);

    const timeout = new Promise<"timed-out">((resolve) => {
      timer = setTimeout(() => resolve("timed-out"), HEALTH_QUERY_TIMEOUT_MS);
    });

    const result = await Promise.race([query, timeout]);
    if (result === "timed-out") {
      return { dbConnected: false, timedOut: true };
    }
    const [row] = rowsOf(result);
    const missing = row.missing === null || row.missing === undefined ? [] : String(row.missing).split(",");
    return {
      dbConnected: true,
      etfCount: Number(row.etf_count),
      fieldCatalogCount: Number(row.field_catalog_count),
      schema: { missingTables: missing },
    };
  } catch (error) {
    logLoadError("health", error);
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
