import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";

export type LatestReportDateDeps = { db: Db; run: BatchRunner };

/**
 * The newest report date (`YYYY-MM-DD`) of a successfully extracted report (`status = 'ok'`) per ETF
 * symbol, inactive ETFs included; an ETF with no such report is simply absent. Read-only, one
 * statement; no values, URLs or error messages leave this module (US-059 AC2).
 */
export async function loadLatestReportDates(deps: LatestReportDateDeps): Promise<ReadonlyMap<string, string>> {
  const [result] = await deps.run([
    deps.db.execute(
      sql`select "e"."symbol" as "symbol", max("r"."report_date")::text as "report_date"
          from "reports" "r"
          join "etfs" "e" on "e"."id" = "r"."etf_id"
          where "r"."status" = 'ok'
          group by "e"."symbol"`,
    ),
  ]);
  const dates = new Map<string, string>();
  for (const row of rowsOf(result)) {
    if (row.report_date !== null && row.report_date !== undefined) {
      dates.set(String(row.symbol), String(row.report_date));
    }
  }
  return dates;
}
