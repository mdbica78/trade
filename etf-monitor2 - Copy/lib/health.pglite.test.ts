import { integer, pgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../test/helpers/pglite";
import { pgliteDb } from "../test/helpers/pglite-drizzle";
import { getHealthStatus, schemaTableNames } from "./health";
import * as schema from "./db/schema";

describe("getHealthStatus over a real PGlite database (AC3)", () => {
  let empty: EmptyTestDatabase;

  beforeEach(async () => {
    empty = await createEmptyTestDatabase();
  }, 60_000);

  afterEach(async () => {
    await empty.close();
  });

  it("HS-1: fully migrated schema has no missing tables", async () => {
    const db = pgliteDb(empty.pg);
    const status = await getHealthStatus(db);
    expect(status).toEqual({
      dbConnected: true,
      etfCount: 0,
      fieldCatalogCount: 0,
      schema: { missingTables: [] },
    });
  }, 60_000);

  it("HS-2: a dropped table is named", async () => {
    await empty.pg.exec(`drop table "etf_report_links"`);
    const db = pgliteDb(empty.pg);
    const status = await getHealthStatus(db);
    expect(status.dbConnected).toBe(true);
    if (status.dbConnected) {
      expect(status.schema.missingTables).toEqual(["etf_report_links"]);
    }
  }, 60_000);

  it("HS-3: the table list is derived, no hand-kept list", async () => {
    const db = pgliteDb(empty.pg);
    const syntheticSchema = {
      ...schema,
      syntheticProbe: pgTable("synthetic_probe", { id: integer("id") }),
    };
    const status = await getHealthStatus(db, { tables: schemaTableNames(syntheticSchema) });
    expect(status.dbConnected).toBe(true);
    if (status.dbConnected) {
      expect(status.schema.missingTables).toEqual(["synthetic_probe"]);
    }
  }, 60_000);
});
