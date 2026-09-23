import { count } from "drizzle-orm";
import type { Db } from "./db";
import { etfs, fieldCatalog } from "./db/schema";

export type HealthStatus =
  | { dbConnected: true; etfCount: number; fieldCatalogCount: number }
  | { dbConnected: false; error: string };

export async function getHealthStatus(db: Db): Promise<HealthStatus> {
  try {
    const [[{ count: etfCount }], [{ count: fieldCatalogCount }]] = await Promise.all([
      db.select({ count: count() }).from(etfs),
      db.select({ count: count() }).from(fieldCatalog),
    ]);
    return { dbConnected: true, etfCount, fieldCatalogCount };
  } catch (error) {
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  }
}
