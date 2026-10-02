import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schemaTableNames } from "../../lib/health";
import * as schema from "../../lib/db/schema";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "./pglite";

const DRIZZLE_DIR = path.join(__dirname, "..", "..", "drizzle");

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
});

afterEach(async () => {
  await db.close();
});

describe("createEmptyTestDatabase applies every journal migration, in order (US-030 AC1)", () => {
  it("PM-1: etf_report_links exists in a fresh PGlite database", async () => {
    const result = await db.pg.query<{ exists: string | null }>(`select to_regclass('etf_report_links') as "exists"`);
    expect(result.rows[0].exists).not.toBeNull();
  });

  it("PM-2: deleting an etfs row deletes its etf_report_links row (ON DELETE CASCADE)", async () => {
    const etf = await db.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
      ["XYZ", "XYZ fund", "https://bvb.ro/XYZ", null],
    );
    const etfId = etf.rows[0].id;
    await db.pg.query(
      `insert into "etf_report_links" ("etf_id", "source_url", "discovered_at") values ($1, $2, $3)`,
      [etfId, "https://bvb.ro/XYZ.pdf", new Date("2026-09-27T08:00:00Z")],
    );
    expect((await db.pg.query('select * from "etf_report_links" where "etf_id" = $1', [etfId])).rows).toHaveLength(1);

    await db.pg.query('delete from "etfs" where "id" = $1', [etfId]);

    expect((await db.pg.query('select * from "etf_report_links" where "etf_id" = $1', [etfId])).rows).toHaveLength(0);
  });

  it("PM-3: every drizzle/*.sql file is listed in the journal, so no migration can be silently skipped", () => {
    const journal = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    const journalTags = new Set(journal.entries.map((e) => e.tag));
    const sqlFiles = readdirSync(DRIZZLE_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""));
    expect(sqlFiles.length).toBeGreaterThanOrEqual(2);
    for (const tag of sqlFiles) {
      expect(journalTags.has(tag), `${tag}.sql is not listed in the journal`).toBe(true);
    }
  });

  it("PM-5: ai_provider_keys is journaled after home display settings and stores ciphertext-only rows", async () => {
    const journal = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const homeDisplay = journal.entries.find((entry) => entry.tag === "0002_home_display_settings");
    const providerKeys = journal.entries.find((entry) => entry.tag === "0003_ai_provider_keys");
    expect(homeDisplay).toBeDefined();
    expect(providerKeys).toBeDefined();
    expect(providerKeys!.idx).toBeGreaterThan(homeDisplay!.idx);

    await db.pg.query(
      `insert into "ai_provider_keys" ("provider_id", "ciphertext", "key_source", "updated_at") values ($1, $2, $3, $4)`,
      ["gemini", "fake-ciphertext-only", "master", new Date("2026-10-02T12:00:00Z")],
    );
    const result = await db.pg.query<{
      provider_id: string;
      key_source: string;
      updated_at: Date;
      ciphertext_present: boolean;
    }>(
      `select "provider_id", "key_source", "updated_at", length("ciphertext") > 0 as "ciphertext_present"
       from "ai_provider_keys" where "provider_id" = $1`,
      ["gemini"],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].provider_id).toBe("gemini");
    expect(result.rows[0].key_source).toBe("master");
    expect(result.rows[0].updated_at.toISOString()).toBe("2026-10-02T12:00:00.000Z");
    expect(result.rows[0].ciphertext_present).toBe(true);
  });

  it("PM-4: every table in lib/db/schema.ts exists in the migrated PGlite database (US-048 AC6)", async () => {
    for (const table of schemaTableNames(schema)) {
      const result = await db.pg.query<{ exists: string | null }>(`select to_regclass($1) as "exists"`, [table]);
      expect(result.rows[0].exists, `table "${table}" is declared in schema.ts but missing after migration`).not.toBeNull();
    }
  });

  it("HD-PM-1: deleting an ETF deletes its home display visibility row (US-047 AC8)", async () => {
    const etf = await db.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url") values ($1, $2, $3) returning "id"`,
      ["HOMEVIEW", "Home view fund", "https://bvb.ro/HOMEVIEW"],
    );
    const etfId = etf.rows[0].id;
    await db.pg.query(`insert into "home_display_etfs" ("etf_id", "visible") values ($1, false)`, [etfId]);
    await db.pg.query(`delete from "etfs" where "id" = $1`, [etfId]);
    expect((await db.pg.query(`select * from "home_display_etfs" where "etf_id" = $1`, [etfId])).rows).toHaveLength(0);
  });
});
