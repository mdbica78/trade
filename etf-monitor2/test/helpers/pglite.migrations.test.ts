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

  it("W-PM-1: the generated widget migration follows 0003 and enforces the closed schema", async () => {
    const journal = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    expect(journal.entries.find((entry) => entry.tag === "0004_etf_widgets")?.idx)
      .toBeGreaterThan(journal.entries.find((entry) => entry.tag === "0003_ai_provider_keys")!.idx);
    expect((await db.pg.query<{ exists: string | null }>(`select to_regclass('etf_widgets') as "exists"`)).rows[0].exists).not.toBeNull();

    const etf = await db.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url") values ('WIDGET', 'Widget ETF', 'https://bvb.ro/WIDGET') returning "id"`,
    );
    const id = etf.rows[0].id;
    const insert = `insert into "etf_widgets"
      ("etf_id", "slot", "operation", "field_key", "period_unit", "period_amount", "updated_at")
      values ($1, $2, $3, 'net_asset', $4, $5, '2026-10-03T00:00:00Z')`;
    await db.pg.query(insert, [id, 1, "change", "days", 1]);
    for (const [etfId, slot, operation, periodUnit, amount] of [
      [id, 1, "change", "days", 1],
      [id, 0, "change", "days", 1],
      [id, 7, "change", "days", 1],
      [id, 1.5, "change", "days", 1],
      [id, 2, "expression", "days", 1],
      [id, 2, "average", "weeks", 1],
      [id, 2, "average", "reports", 0],
      [id, 2, "average", "reports", 366],
      [id, 2, "average", "reports", 1.5],
      [id + 100000, 2, "average", "reports", 1],
    ] as const) {
      await expect(db.pg.query(insert, [etfId, slot, operation, periodUnit, amount])).rejects.toThrow();
    }
    await db.pg.query(insert, [id, 6, "max", "reports", 365]);
    await db.pg.query(`delete from "etfs" where "id" = $1`, [id]);
    expect((await db.pg.query(`select "id" from "etf_widgets" where "etf_id" = $1`, [id])).rows).toHaveLength(0);
  });

  it("PM-6: ai_custom_providers exists and its checks reject an http:// URL, a 201-char URL and a 41-char name (US-057 AC5)", async () => {
    expect(
      (await db.pg.query<{ exists: string | null }>(`select to_regclass('ai_custom_providers') as "exists"`)).rows[0]
        .exists,
    ).not.toBeNull();

    const insert = `insert into "ai_custom_providers" ("name", "base_url") values ($1, $2)`;
    await expect(db.pg.query(insert, ["Groq via custom", "http://api.example.com/v1"])).rejects.toThrow();
    const longUrl = `https://api.example.com/${"a".repeat(177)}`;
    expect(longUrl.length).toBe(201);
    await expect(db.pg.query(insert, ["Groq via custom", longUrl])).rejects.toThrow();
    await expect(db.pg.query(insert, ["a".repeat(41), "https://api.example.com/v1"])).rejects.toThrow();

    await db.pg.query(insert, ["Groq via custom", "https://api.example.com/v1"]);
    const rows = (await db.pg.query(`select "name", "base_url" from "ai_custom_providers"`)).rows;
    expect(rows).toEqual([{ name: "Groq via custom", base_url: "https://api.example.com/v1" }]);
  });
});
