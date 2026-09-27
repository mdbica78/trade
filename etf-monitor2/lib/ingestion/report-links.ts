import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { neonBatchRunner, rowsOf, type BatchRunner } from "./store";

export type UpsertReportLinkInput = { etfId: number; sourceUrl: string; discoveredAt: Date };
export type UpsertReportLinkResult = "written" | "rejected_url";

export interface ReportLinkStore {
  upsertReportLink(input: UpsertReportLinkInput): Promise<UpsertReportLinkResult>;
}

/** Same rule as `discovery.ts`'s `resolvePdfHref`: absolute http(s), path ending in `.pdf`. Defence in depth — every caller already gets its URL from discovery. */
export function isStorableReportUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  return parsed.pathname.toLowerCase().endsWith(".pdf");
}

export function buildUpsertReportLinkStatement(db: Db, input: UpsertReportLinkInput) {
  return db.execute(
    sql`insert into "etf_report_links" ("etf_id", "source_url", "discovered_at")
        values (${input.etfId}, ${input.sourceUrl}, ${input.discoveredAt})
        on conflict ("etf_id") do update set
          "source_url" = excluded."source_url",
          "discovered_at" = excluded."discovered_at"`,
  );
}

/** Writes only `etf_report_links`, never batched with a `reports` write (DEC-018 §4). */
export function createDrizzleReportLinkStore(db: Db, run: BatchRunner = neonBatchRunner(db)): ReportLinkStore {
  return {
    async upsertReportLink(input) {
      if (!isStorableReportUrl(input.sourceUrl)) {
        return "rejected_url";
      }
      const [result] = await run([buildUpsertReportLinkStatement(db, input)]);
      rowsOf(result);
      return "written";
    },
  };
}
