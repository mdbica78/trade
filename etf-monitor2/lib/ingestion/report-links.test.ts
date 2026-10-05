import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import type { Db } from "../db/index";
import { buildUpsertReportLinkStatement, createDrizzleReportLinkStore } from "./report-links";
import type { BatchRunner } from "./store";

const mockDb = drizzle.mock({ schema }) as unknown as Db;

describe("buildUpsertReportLinkStatement", () => {
  it("upserts on etf_id, updating source_url and discovered_at", () => {
    const statement = buildUpsertReportLinkStatement(mockDb, {
      etfId: 1,
      sourceUrl: "https://bvb.ro/x.pdf",
      discoveredAt: new Date("2026-09-27T08:00:00Z"),
    });
    const { sql, params } = statement.getQuery();
    expect(sql).toContain('insert into "etf_report_links"');
    expect(sql).toContain('on conflict ("etf_id") do update set');
    expect(sql).toContain('"source_url" = excluded."source_url"');
    expect(sql).toContain('"discovered_at" = excluded."discovered_at"');
    expect(params).toContain(1);
    expect(params).toContain("https://bvb.ro/x.pdf");
  });
});

describe("createDrizzleReportLinkStore", () => {
  it("a storable URL runs exactly one statement", async () => {
    const run: BatchRunner = vi.fn(async () => [[]]);
    const store = createDrizzleReportLinkStore(mockDb, run);
    await store.upsertReportLink({
      etfId: 1,
      sourceUrl: "https://bvb.ro/x.pdf",
      discoveredAt: new Date("2026-09-27T08:00:00Z"),
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect((run as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(1);
  });
});
