import type { FinalJobRunStatus } from "./job-runs";
import { errorText, oneLine } from "./outcome";
import type { DailyEtfOutcome, DailyRunSummary } from "./run-daily";

export const SUCCESS_OUTCOME_CODES = ["ok", "already_ingested"] as const;
export const MAX_LOG_DETAIL_LENGTH = 300;

export type RunStatus = FinalJobRunStatus;

export type RunSummaryResult = { status: RunStatus; etfsProcessed: number; errorsCount: number };

/** By exclusion: anything not in the success list counts as an error, including codes added later. */
export function isErrorOutcome(code: string): boolean {
  return !(SUCCESS_OUTCOME_CODES as readonly string[]).includes(code);
}

export function summarizeRun(etfs: DailyRunSummary["etfs"]): RunSummaryResult {
  const etfsProcessed = etfs.length;
  const errorsCount = etfs.filter((e) => isErrorOutcome(e.outcome.code)).length;
  const status: RunStatus =
    errorsCount === 0 ? "success" : errorsCount === etfsProcessed ? "failed" : "partial";
  return { status, etfsProcessed, errorsCount };
}

/** Replaces every exact, non-empty occurrence of a secret. Same rule as the handler's own redaction. */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    result = result.split(secret).join("[redacted]");
  }
  return result;
}

export function truncateDetail(text: string, max: number = MAX_LOG_DETAIL_LENGTH): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

function reportDateOf(outcome: DailyEtfOutcome): string | undefined {
  return "reportDate" in outcome && typeof outcome.reportDate === "string" ? outcome.reportDate : undefined;
}

/** Redact first, then collapse whitespace, so a match is never broken by an embedded newline. */
function clean(s: string, secrets: readonly string[]): string {
  return oneLine(redactSecrets(s, secrets));
}

function formatEtfLine(entry: { symbol: string; outcome: DailyEtfOutcome }, secrets: readonly string[]): string {
  const date = reportDateOf(entry.outcome);
  const detailWithDate = date ? `${date} ${entry.outcome.detail}` : entry.outcome.detail;
  const symbol = clean(entry.symbol, secrets);
  const code = clean(entry.outcome.code, secrets);
  const detail = truncateDetail(clean(detailWithDate, secrets));
  return `${symbol} ${code} ${detail}`;
}

export function formatRunLog(
  etfs: DailyRunSummary["etfs"],
  result: RunSummaryResult,
  secrets: readonly string[],
): string {
  const summaryLine = `${result.status}: ${result.etfsProcessed} processed, ${result.errorsCount} errors`;
  const lines = etfs.map((entry) => formatEtfLine(entry, secrets));
  return [summaryLine, ...lines].join("\n");
}

export function formatAbortedRunLog(error: unknown, secrets: readonly string[]): string {
  const message = truncateDetail(clean(errorText(error), secrets));
  return `failed: 0 processed, 0 errors\nrun aborted: ${message}`;
}
