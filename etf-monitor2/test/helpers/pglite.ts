import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../lib/db/schema";
import type { Db } from "../../lib/db/index";
import type { BatchRunner } from "../../lib/ingestion/store";

const MIGRATION_PATH = path.join(__dirname, "..", "..", "drizzle", "0000_init.sql");

function migrationStatements(): string[] {
  const sqlText = readFileSync(MIGRATION_PATH, "utf8");
  return sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type EmptyTestDatabase = {
  pg: PGlite;
  /** `drizzle.mock()`: a real query builder that never opens a connection — used only to build statements via `.execute()`. */
  mockDb: Db;
  /** Runs statements in one PGlite transaction, mirroring `db.batch`'s atomicity. */
  runner: BatchRunner;
  /** Runs statements one by one with no transaction, so a mid-list failure leaves earlier writes in place. */
  nonAtomicRunner: BatchRunner;
  close(): Promise<void>;
};

export type TestDatabase = EmptyTestDatabase & { etfId: number };

/** Migrated PGlite database with no seed row — for tests that need to control every row themselves (e.g. seed tests). */
export async function createEmptyTestDatabase(): Promise<EmptyTestDatabase> {
  const pg = new PGlite();
  for (const statement of migrationStatements()) {
    await pg.exec(statement);
  }

  const mockDb = drizzle.mock({ schema }) as unknown as Db;

  const runStatements = async (statements: readonly ReturnType<Db["execute"]>[], atomic: boolean) => {
    const results: unknown[] = [];
    const run = async (query: (sqlText: string, params: unknown[]) => Promise<{ rows: unknown[] }>) => {
      for (const statement of statements) {
        const { sql: sqlText, params } = statement.getQuery();
        const result = await query(sqlText, params);
        results.push(result.rows);
      }
    };
    if (atomic) {
      await pg.transaction(async (tx) => {
        await run((sqlText, params) => tx.query(sqlText, params));
      });
    } else {
      await run((sqlText, params) => pg.query(sqlText, params));
    }
    return results;
  };

  const runner: BatchRunner = (statements) => runStatements(statements, true);
  const nonAtomicRunner: BatchRunner = (statements) => runStatements(statements, false);

  return {
    pg,
    mockDb,
    runner,
    nonAtomicRunner,
    async close() {
      await pg.close();
    },
  };
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const empty = await createEmptyTestDatabase();

  const seeded = await empty.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
    ["BTBETRETF", "BT Index Romania ETF BET-TR", "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF", "brd-depositary"],
  );
  const etfId = seeded.rows[0].id;

  return { ...empty, etfId };
}
