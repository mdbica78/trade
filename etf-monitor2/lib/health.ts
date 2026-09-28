import { count, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { etfs, fieldCatalog } from "./db/schema";
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
 * One statement, one parameter — never names a table literally, so it stays outside
 * `lib/ingestion/boundaries.test.ts` BD-16's `from/join "etf_report_links"` scan.
 */
export function buildSchemaProbeStatement(db: Db, tables: readonly string[]) {
  return db.execute(
    sql`select "t"."name" from unnest(string_to_array(${tables.join(",")}::text, ',')) as "t"("name")
        where to_regclass('public.' || "t"."name") is null order by "t"."name"`,
  );
}

export async function getHealthStatus(db: Db, options: { tables?: readonly string[] } = {}): Promise<HealthStatus> {
  const tables = options.tables ?? schemaTableNames(schema);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = (async () => {
      const counts = await Promise.all([
        db.select({ count: count() }).from(etfs),
        db.select({ count: count() }).from(fieldCatalog),
      ]);
      const missingRows = rowsOf(await db.execute(buildSchemaProbeStatement(db, tables)));
      const missingTables = missingRows.map((row) => String(row.name));
      return { counts, missingTables };
    })();
    // A late rejection past the timeout is swallowed here, not left unhandled or awaited again.
    query.catch(() => undefined);

    const timeout = new Promise<"timed-out">((resolve) => {
      timer = setTimeout(() => resolve("timed-out"), HEALTH_QUERY_TIMEOUT_MS);
    });

    const result = await Promise.race([query, timeout]);
    if (result === "timed-out") {
      return { dbConnected: false, timedOut: true };
    }
    const [[{ count: etfCount }], [{ count: fieldCatalogCount }]] = result.counts;
    return { dbConnected: true, etfCount, fieldCatalogCount, schema: { missingTables: result.missingTables } };
  } catch (error) {
    logLoadError("health", error);
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
