import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { neonBatchRunner, type BatchRunner } from "./store";

export type UpsertReportLinkInput = { etfId: number; sourceUrl: string; discoveredAt: Date };

export interface ReportLinkStore {
  upsertReportLink(input: UpsertReportLinkInput): Promise<void>;
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
      await run([buildUpsertReportLinkStatement(db, input)]);
    },
  };
}
