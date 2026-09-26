import { isIsoCalendarDate } from "../extraction/adapters/validate";
import { STALE_RUN_LOG_LINE } from "../ingestion/job-runs";
import { INGEST_OUTCOME_CODES, type IngestOutcome, type IngestOutcomeCode } from "../ingestion/outcome";

export const CODES_WITH_REPORT_DATE = ["ok", "already_ingested", "parse_error", "persist_error"] as const;

export function isKnownOutcomeCode(code: string): code is IngestOutcomeCode {
  return (INGEST_OUTCOME_CODES as readonly string[]).includes(code);
}

function codeCanCarryReportDate(code: string): boolean {
  return (CODES_WITH_REPORT_DATE as readonly string[]).includes(code);
}

export type RunLogSummary = { status: string; processed: number; errors: number };

export type RunLogEntry =
  | { kind: "etf"; symbol: string; code: string; reportDate?: string; detail: string }
  | { kind: "aborted"; detail: string }
  | { kind: "stale" }
  | { kind: "unparsed"; text: string };

export type ParsedRunLog = { summary: RunLogSummary | null; entries: RunLogEntry[] };

const SUMMARY_RE = /^([a-z_]+): (\d+) processed, (\d+) errors$/;
const ETF_LINE_RE = /^([A-Z0-9]+) ([a-z_]+) (.+)$/;
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2}) (.+)$/;
const ABORTED_PREFIX = "run aborted: ";

function parseEtfLine(line: string): RunLogEntry {
  const match = ETF_LINE_RE.exec(line);
  if (!match) {
    return { kind: "unparsed", text: line };
  }
  const [, symbol, code, rest] = match;
  if (codeCanCarryReportDate(code)) {
    const dateMatch = DATE_PREFIX_RE.exec(rest);
    if (dateMatch && isIsoCalendarDate(dateMatch[1])) {
      return { kind: "etf", symbol, code, reportDate: dateMatch[1], detail: dateMatch[2] };
    }
  }
  return { kind: "etf", symbol, code, detail: rest };
}

/**
 * Parses a `job_runs.log` string written by `formatRunLog` / `formatAbortedRunLog`
 * (`lib/ingestion/job-run-summary.ts`) plus a possible stale-run sweep line. Never throws
 * and never drops a line: anything it cannot recognise comes back as `unparsed`, verbatim.
 */
export function parseRunLog(log: string | null): ParsedRunLog {
  if (log === null || log === "") {
    return { summary: null, entries: [] };
  }

  const lines = log.split("\n");
  let summary: RunLogSummary | null = null;
  const entries: RunLogEntry[] = [];
  let startIndex = 0;

  const summaryMatch = SUMMARY_RE.exec(lines[0]);
  if (summaryMatch) {
    summary = { status: summaryMatch[1], processed: Number(summaryMatch[2]), errors: Number(summaryMatch[3]) };
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line === STALE_RUN_LOG_LINE) {
      entries.push({ kind: "stale" });
    } else if (line.startsWith(ABORTED_PREFIX)) {
      entries.push({ kind: "aborted", detail: line.slice(ABORTED_PREFIX.length) });
    } else {
      entries.push(parseEtfLine(line));
    }
  }

  return { summary, entries };
}

export type { IngestOutcome };
