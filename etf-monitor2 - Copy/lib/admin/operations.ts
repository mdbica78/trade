import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { jobRuns, reports } from "../db/schema";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { parsePgBoolean } from "../ingestion/load-etfs";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";
import { parseRunLog, type ParsedRunLog } from "./run-log";

export const JOB_RUN_STATUSES = jobRuns.status.enumValues;
export const REPORT_STATUSES = reports.status.enumValues;

export function isKnownRunStatus(status: string): status is (typeof JOB_RUN_STATUSES)[number] {
  return (JOB_RUN_STATUSES as readonly string[]).includes(status);
}

export function isKnownReportStatus(status: string): status is (typeof REPORT_STATUSES)[number] {
  return (REPORT_STATUSES as readonly string[]).includes(status);
}

export type OperationsRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  etfsProcessed: number;
  errorsCount: number;
  log: ParsedRunLog;
};

export type EtfOperationalStatus = {
  symbol: string;
  isActive: boolean;
  adapterAvailable: boolean;
  lastOk: { reportDate: string; fetchedAt: string | null } | null;
};

export type NonOkReportValue = { fieldKey: string; labelRo: string; labelEn: string; numericValue: string | null };

export type NonOkReport = {
  id: number;
  symbol: string;
  reportDate: string;
  status: string;
  errorMessage: string | null;
  sourceUrl: string | null;
  values: NonOkReportValue[];
};

export type OperationsView = {
  runs: readonly OperationsRun[];
  etfs: readonly EtfOperationalStatus[];
  parseErrors: readonly NonOkReport[];
};

/** Text on both neon-http and PGlite, independent of the session time zone (story Notes, Sprint 4 audit N7). */
function isoTimestamp(qualifiedColumn: string) {
  return sql`to_char(${sql.raw(qualifiedColumn)} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
}

export function buildRunsStatement(db: Db) {
  return db.execute(
    sql`select "id", ${isoTimestamp('"started_at"')} as "started_at", ${isoTimestamp('"finished_at"')} as "finished_at",
        "status", "etfs_processed", "errors_count", "log"
        from "job_runs"
        order by "started_at" desc, "id" desc`,
  );
}

export function buildEtfStatusStatement(db: Db) {
  return db.execute(
    sql`select "e"."symbol", "e"."adapter_key", "e"."is_active",
        to_char("latest"."report_date", 'YYYY-MM-DD') as "report_date", ${isoTimestamp('"latest"."fetched_at"')} as "fetched_at"
        from "etfs" "e"
        left join (
          select distinct on ("r"."etf_id") "r"."etf_id", "r"."report_date", "r"."fetched_at"
          from "reports" "r"
          where "r"."status" = 'ok'
          order by "r"."etf_id", "r"."report_date" desc, "r"."id" desc
        ) "latest" on "latest"."etf_id" = "e"."id"
        order by "e"."symbol"`,
  );
}

export function buildParseErrorReportsStatement(db: Db) {
  return db.execute(
    sql`select "r"."id", "e"."symbol", to_char("r"."report_date", 'YYYY-MM-DD') as "report_date", "r"."status",
        "r"."error_message", "r"."source_url", "rv"."field_key", "rv"."numeric_value", "fc"."label_ro", "fc"."label_en"
        from "reports" "r"
        join "etfs" "e" on "e"."id" = "r"."etf_id"
        left join "report_values" "rv" on "rv"."report_id" = "r"."id"
        left join "field_catalog" "fc" on "fc"."adapter_key" = "e"."adapter_key" and "fc"."field_key" = "rv"."field_key"
        where "r"."status" <> 'ok'
        order by "r"."report_date" desc, "r"."id" desc, "rv"."field_key"`,
  );
}

function parseRuns(rows: readonly Record<string, unknown>[]): OperationsRun[] {
  return rows.map((row) => ({
    id: Number(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    status: String(row.status),
    etfsProcessed: Number(row.etfs_processed),
    errorsCount: Number(row.errors_count),
    log: parseRunLog(row.log === null ? null : String(row.log)),
  }));
}

function parseEtfStatuses(rows: readonly Record<string, unknown>[], registry: AdapterRegistry): EtfOperationalStatus[] {
  return rows.map((row) => {
    const adapterKey = row.adapter_key === null ? null : String(row.adapter_key);
    return {
      symbol: String(row.symbol),
      isActive: parsePgBoolean(row.is_active),
      adapterAvailable: adapterKey !== null && registry.get(adapterKey) !== undefined,
      lastOk:
        row.report_date === null
          ? null
          : { reportDate: String(row.report_date), fetchedAt: row.fetched_at === null ? null : String(row.fetched_at) },
    };
  });
}

function parseNonOkReports(rows: readonly Record<string, unknown>[]): NonOkReport[] {
  const order: number[] = [];
  const byId = new Map<number, NonOkReport>();

  for (const row of rows) {
    const id = Number(row.id);
    let report = byId.get(id);
    if (!report) {
      report = {
        id,
        symbol: String(row.symbol),
        reportDate: String(row.report_date),
        status: String(row.status),
        errorMessage: row.error_message === null ? null : String(row.error_message),
        sourceUrl: row.source_url === null ? null : String(row.source_url),
        values: [],
      };
      byId.set(id, report);
      order.push(id);
    }
    if (row.field_key !== null && row.field_key !== undefined) {
      const fieldKey = String(row.field_key);
      report.values.push({
        fieldKey,
        labelRo: row.label_ro === null || row.label_ro === undefined ? fieldKey : String(row.label_ro),
        labelEn: row.label_en === null || row.label_en === undefined ? fieldKey : String(row.label_en),
        numericValue: row.numeric_value === null ? null : String(row.numeric_value),
      });
    }
  }

  return order.map((id) => byId.get(id)!);
}

/**
 * Loads the operational dashboard's view model in one batch of three read-only statements
 * (AC10). Read-only: `lib/admin/` never writes.
 */
export function createOperationsLoader(
  db: Db,
  registry: AdapterRegistry = defaultAdapterRegistry,
  run: BatchRunner = neonBatchRunner(db),
): () => Promise<OperationsView> {
  return async () => {
    const [runsResult, etfsResult, parseErrorsResult] = await run([
      buildRunsStatement(db),
      buildEtfStatusStatement(db),
      buildParseErrorReportsStatement(db),
    ]);
    return {
      runs: parseRuns(rowsOf(runsResult)),
      etfs: parseEtfStatuses(rowsOf(etfsResult), registry),
      parseErrors: parseNonOkReports(rowsOf(parseErrorsResult)),
    };
  };
}
