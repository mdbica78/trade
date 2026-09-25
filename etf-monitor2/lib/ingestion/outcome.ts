import type { ContractViolation } from "../extraction/adapters/validate";

export const INGEST_OUTCOME_CODES = [
  "ok",
  "already_ingested",
  "missing",
  "fetch_error",
  "no_adapter",
  "parse_error",
  "persist_error",
] as const;

export type IngestOutcomeCode = (typeof INGEST_OUTCOME_CODES)[number];

export type ParseErrorReason =
  | "unreadable_text"
  | "format_not_recognised"
  | "extraction_failed"
  | "contract_violation"
  | "incomplete"
  | "unexpected";

type Base = { symbol: string; detail: string };

export type IngestOutcome =
  | (Base & { code: "ok"; reportDate: string; valuesWritten: number; sourceUrl: string })
  | (Base & { code: "already_ingested"; reportDate: string })
  | (Base & { code: "missing"; reason: "no_report_entries" | "list_not_found" })
  | (Base & {
      code: "fetch_error";
      stage: "discovery" | "download";
      kind: "http_error" | "network" | "timeout" | "not_pdf" | "unexpected";
      httpStatus?: number;
    })
  | (Base & { code: "no_adapter" })
  | (Base & { code: "parse_error"; reason: ParseErrorReason; reportDate?: string })
  | (Base & { code: "persist_error"; reportDate?: string });

/** Collapses every whitespace run (including newlines) to one space and trims. Never empty. */
export function oneLine(s: string): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed === "" ? "(no message)" : collapsed;
}

export function formatMissingFields(keys: readonly string[]): string {
  return `missing fields: ${keys.join(", ")}`;
}

/** Uses only `rule` and `fieldKey`, never `message` (which quotes extracted values, story step 5). */
export function formatViolations(violations: readonly ContractViolation[]): string {
  const parts = violations.map((v) => (v.fieldKey ? `${v.rule}(${v.fieldKey})` : v.rule));
  return `contract violations: ${parts.join("; ")}`;
}

export function formatFetchError(
  stage: "discovery" | "download",
  kind: "http_error" | "network" | "timeout" | "not_pdf" | "unexpected",
  httpStatus: number | undefined,
  message: string,
): string {
  const status = httpStatus === undefined ? "" : ` ${httpStatus}`;
  return `${stage} ${kind}${status}: ${message}`;
}

/** Never throws, even if `String()` would (e.g. a malformed `Symbol` or a throwing `toString`). */
export function errorText(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  try {
    return String(e);
  } catch {
    return "(unprintable error)";
  }
}
