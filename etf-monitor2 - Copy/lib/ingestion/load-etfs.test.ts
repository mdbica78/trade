import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import type { Db } from "../db/index";
import { buildLoadActiveEtfsStatement, createDrizzleEtfLoader } from "./load-etfs";

const mockDb = drizzle.mock({ schema }) as unknown as Db;

describe("buildLoadActiveEtfsStatement", () => {
  it("filters is_active, left joins tracked_fields, orders by display_order then field_key", () => {
    const { sql } = buildLoadActiveEtfsStatement(mockDb).getQuery();
    expect(sql).toContain('"is_active" = true');
    expect(sql).toContain('left join "tracked_fields"');
    const orderIdx = sql.toLowerCase().indexOf("order by");
    expect(orderIdx).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIdx);
    expect(orderClause.indexOf('"display_order"')).toBeLessThan(orderClause.indexOf('"field_key"'));
  });
});

describe("createDrizzleEtfLoader", () => {
  it("LQ-2c: calls the runner exactly once with one statement", async () => {
    const recordingRunner = vi.fn(async (_statements: readonly unknown[]) => [[]]);
    const loader = createDrizzleEtfLoader(mockDb, recordingRunner);
    await loader();
    expect(recordingRunner).toHaveBeenCalledTimes(1);
    expect(recordingRunner.mock.calls[0][0]).toHaveLength(1);
  });

  it("groups rows by id, collects field_key in row order, and maps snake_case columns", async () => {
    const rows = [
      { id: 1, symbol: "AAA", bvb_url: "https://bvb.ro/AAA", adapter_key: "brd-depositary", is_active: true, field_key: "units_in_circulation" },
      { id: 1, symbol: "AAA", bvb_url: "https://bvb.ro/AAA", adapter_key: "brd-depositary", is_active: true, field_key: "nav_per_unit" },
      { id: 2, symbol: "BBB", bvb_url: "https://bvb.ro/BBB", adapter_key: null, is_active: true, field_key: null },
    ];
    const runner = vi.fn(async () => [rows]);
    const loader = createDrizzleEtfLoader(mockDb, runner);
    const result = await loader();
    expect(result).toEqual([
      { id: 1, symbol: "AAA", bvbUrl: "https://bvb.ro/AAA", adapterKey: "brd-depositary", isActive: true, trackedFieldKeys: ["units_in_circulation", "nav_per_unit"] },
      { id: 2, symbol: "BBB", bvbUrl: "https://bvb.ro/BBB", adapterKey: null, isActive: true, trackedFieldKeys: [] },
    ]);
  });

  it("throws on an unexpected is_active value instead of silently skipping every ETF", async () => {
    const rows = [{ id: 1, symbol: "AAA", bvb_url: "x", adapter_key: null, is_active: "maybe", field_key: null }];
    const runner = vi.fn(async () => [rows]);
    const loader = createDrizzleEtfLoader(mockDb, runner);
    await expect(loader()).rejects.toThrow(/is_active/);
  });
});
