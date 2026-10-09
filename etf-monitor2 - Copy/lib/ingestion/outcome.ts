import type { ContractViolation } from "../extraction/adapters/validate";

export const INGEST_OUTCOME_CODES = [
  "ok",
  "already_ingested",
  "missing",
  "fetch_error",
  "no_adapter",
  "parse_error",
  "persist_error",
  "internal_error",
  "not_attempted",
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
  | (Base & { code: "persist_error"; reportDate?: string })
  | (Base & { code: "internal_error" })
  | (Base & { code: "not_attempted" });

/** Collapses every whitespace run (including newlines) to one space and trims. Never empty. */
export function oneLine(s: string): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed === "" ? "(no message)" : collapsed;
}

export function formatMissingFields(keys: readonly string[]): string {
  return `missing fields: ${keys.join(", ")}`;
}

/** The four filing-level counts, first in every combined detail so the 300-char cap never cuts them (US-037 AC1/AC3/AC5). */
export function formatFilingCounts(counts: {
  stored: number;
  alreadyStored: number;
  failed: number;
  notAttempted: number;
  truncated: boolean;
}): string {
  const base = `stored ${counts.stored}, already stored ${counts.alreadyStored}, failed ${counts.failed}, not attempted ${counts.notAttempted}`;
  return counts.truncated ? `${base}, truncated` : base;
}

/** Uses only `rule` and `fieldKey`, never `message` (which quotes extracted values, story step 5). */
export function formatViolations(violations: readonly ContractViolation[]): string {
  const parts = violations.map((v) => (v.fieldKey ? `${v.rule}(${v.fieldKey})` : v.rule));
  return `contract violations: ${parts.join("; ")}`;
}

export type NoAdapterLinkOutcome =
  | { kind: "stored" }
  | { kind: "rejected_url" }
  | { kind: "not_found"; reason: "no_report_entries" | "list_not_found" }
  | { kind: "discovery_error"; errorKind: "http_error" | "network" | "timeout" | "unexpected"; httpStatus?: number }
  | { kind: "write_failed" };

/** Builds the no-adapter detail line from fixed words only — never an error message or the URL (AGENTS.md secrets rule, story AC8). */
export function formatNoAdapterDetail(base: string, link: NoAdapterLinkOutcome): string {
  switch (link.kind) {
    case "stored":
      return oneLine(`${base}; report link stored`);
    case "rejected_url":
      return oneLine(`${base}; report link not stored: rejected url`);
    case "not_found":
      return oneLine(`${base}; report link not stored: not_found: ${link.reason}`);
    case "discovery_error": {
      const status = link.httpStatus === undefined ? "" : ` ${link.httpStatus}`;
      return oneLine(`${base}; report link not stored: discovery ${link.errorKind}${status}`);
    }
    case "write_failed":
      return oneLine(`${base}; report link not stored: write failed`);
  }
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
