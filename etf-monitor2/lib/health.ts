import { count } from "drizzle-orm";
import type { Db } from "./db";
import { etfs, fieldCatalog } from "./db/schema";

export type HealthStatus =
  | { dbConnected: true; etfCount: number; fieldCatalogCount: number }
  | { dbConnected: false; error: string }
  | { dbConnected: false; timedOut: true };

/**
 * Well under Vercel's default 10s duration for a Hobby function with no `maxDuration` set
 * (`/health` sets none), and above a Neon free-tier cold start after its ~5 min sleep
 * (requirements §4), which takes a few seconds (US-031 plan section 4, risk R6).
 */
export const HEALTH_QUERY_TIMEOUT_MS = 8_000;

export async function getHealthStatus(db: Db): Promise<HealthStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = Promise.all([
      db.select({ count: count() }).from(etfs),
      db.select({ count: count() }).from(fieldCatalog),
    ]);
    // A late rejection past the timeout is swallowed here, not left unhandled or awaited again.
    query.catch(() => undefined);

    const timeout = new Promise<"timed-out">((resolve) => {
      timer = setTimeout(() => resolve("timed-out"), HEALTH_QUERY_TIMEOUT_MS);
    });

    const result = await Promise.race([query, timeout]);
    if (result === "timed-out") {
      return { dbConnected: false, timedOut: true };
    }
    const [[{ count: etfCount }], [{ count: fieldCatalogCount }]] = result;
    return { dbConnected: true, etfCount, fieldCatalogCount };
  } catch (error) {
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
