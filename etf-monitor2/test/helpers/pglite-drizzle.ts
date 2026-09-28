import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../lib/db/schema";
import type { Db } from "../../lib/db/index";

/** Real drizzle query builder over a migrated PGlite instance — used where `getHealthStatus` needs `db.select`/`db.execute` to actually run (plan §2.6). */
export function pgliteDb(pg: PGlite): Db {
  return drizzle(pg, { schema }) as unknown as Db;
}
