import { describe, expect, expectTypeOf, it } from "vitest";
import { formatAbortedRunLog, formatRunLog, summarizeRun } from "../ingestion/job-run-summary";
import { STALE_RUN_LOG_LINE } from "../ingestion/job-runs";
import type { IngestOutcome } from "../ingestion/outcome";
import { CODES_WITH_REPORT_DATE, isKnownOutcomeCode, parseRunLog } from "./run-log";

function entry(outcome: IngestOutcome) {
  return { symbol: outcome.symbol, outcome };
}

describe("RL: parseRunLog — round trip with the real formatters", () => {
  it("RL-1/RL-9/RL-10: every code round-trips through formatRunLog, with and without a report date where allowed", () => {
    const outcomes: IngestOutcome[] = [
      { code: "ok", symbol: "AAA", reportDate: "2026-09-22", valuesWritten: 2, sourceUrl: "https://x", detail: "stored 2 values" },
      { code: "already_ingested", symbol: "BBB", reportDate: "2026-09-21", detail: "report already stored" },
      { code: "missing", symbol: "CCC", reason: "list_not_found", detail: "no report found: list_not_found" },
      { code: "fetch_error", symbol: "DDD", stage: "discovery", kind: "network", detail: "discovery network: boom" },
      { code: "no_adapter", symbol: "EEE", detail: "no adapter: adapter_key not set" },
      { code: "parse_error", symbol: "FFF", reason: "incomplete", reportDate: "2026-09-20", detail: "missing fields: nav_per_unit" },
      { code: "parse_error", symbol: "GGG", reason: "unreadable_text", detail: "unreadable text: bad" },
      { code: "persist_error", symbol: "HHH", reportDate: "2026-09-19", detail: "database write failed: down" },
      { code: "persist_error", symbol: "III", detail: "database write failed: down" },
      { code: "internal_error", symbol: "JJJ", detail: "internal error: boom" },
    ];

    const summary = summarizeRun(outcomes.map((o) => ({ symbol: o.symbol, outcome: o })));
    const log = formatRunLog(outcomes.map((o) => entry(o)), summary, []);
    const parsed = parseRunLog(log);

    expect(parsed.summary).toEqual({ status: summary.status, processed: summary.etfsProcessed, errors: summary.errorsCount });
    expect(parsed.entries).toEqual(
      outcomes.map((o) => ({
        kind: "etf",
        symbol: o.symbol,
        code: o.code,
        detail: o.detail,
        ...("reportDate" in o && o.reportDate !== undefined ? { reportDate: o.reportDate } : {}),
      })),
    );
  });

  it("RL-2: a long, multi-line detail comes back exactly as formatRunLog wrote it (truncated, one line)", () => {
    const longDetail = `${"x".repeat(310)}\ny\tz`;
    const outcome: IngestOutcome = { code: "no_adapter", symbol: "AAA", detail: longDetail };
    const summary = summarizeRun([entry(outcome)]);
    const log = formatRunLog([entry(outcome)], summary, []);
    const expectedDetail = `${"x".repeat(297)}...`;
    expect(log).toBe(`${summary.status}: ${summary.etfsProcessed} processed, ${summary.errorsCount} errors\nAAA no_adapter ${expectedDetail}`);
    const parsed = parseRunLog(log);
    expect(parsed.entries).toEqual([{ kind: "etf", symbol: "AAA", code: "no_adapter", detail: expectedDetail }]);
  });

  it("RL-3: a secret in a detail comes back redacted", () => {
    const outcome: IngestOutcome = { code: "fetch_error", symbol: "AAA", stage: "discovery", kind: "network", detail: "boom secret-token-123 end" };
    const summary = summarizeRun([entry(outcome)]);
    const log = formatRunLog([entry(outcome)], summary, ["secret-token-123"]);
    const parsed = parseRunLog(log);
    expect(parsed.entries).toEqual([{ kind: "etf", symbol: "AAA", code: "fetch_error", detail: "boom [redacted] end" }]);
  });

  it("RL-4: formatAbortedRunLog round-trips as an aborted entry", () => {
    const log = formatAbortedRunLog(new Error("boom"), []);
    const parsed = parseRunLog(log);
    expect(parsed.summary).toEqual({ status: "failed", processed: 0, errors: 0 });
    expect(parsed.entries).toEqual([{ kind: "aborted", detail: "boom" }]);
  });

  it("RL-5: a stale line appended after ETF lines parses as a trailing stale entry", () => {
    const outcome: IngestOutcome = { code: "ok", symbol: "AAA", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "https://x", detail: "stored 1 values" };
    const summary = summarizeRun([entry(outcome)]);
    const log = `${formatRunLog([entry(outcome)], summary, [])}\n${STALE_RUN_LOG_LINE}`;
    const parsed = parseRunLog(log);
    expect(parsed.entries).toEqual([
      { kind: "etf", symbol: "AAA", code: "ok", reportDate: "2026-09-22", detail: "stored 1 values" },
      { kind: "stale" },
    ]);
  });

  it("RL-6: a log that is only the stale line (swept while NULL) gives summary null and one stale entry", () => {
    const parsed = parseRunLog(STALE_RUN_LOG_LINE);
    expect(parsed).toEqual({ summary: null, entries: [{ kind: "stale" }] });
  });

  it("RL-7: null and empty string give empty results", () => {
    expect(parseRunLog(null)).toEqual({ summary: null, entries: [] });
    expect(parseRunLog("")).toEqual({ summary: null, entries: [] });
  });

  it("RL-8: unparseable lines are kept verbatim, never dropped, never throws", () => {
    const log = [
      "success: 1 processed, 0 errors",
      "garbage",
      "lower case line here",
      "BTBETRETF",
      "",
      "[redacted] ok x",
    ].join("\n");
    const parsed = parseRunLog(log);
    expect(parsed.entries).toEqual([
      { kind: "unparsed", text: "garbage" },
      { kind: "unparsed", text: "lower case line here" },
      { kind: "unparsed", text: "BTBETRETF" },
      { kind: "unparsed", text: "" },
      { kind: "unparsed", text: "[redacted] ok x" },
    ]);
  });

  it("RL-9: an unknown code keeps its whole detail, isKnownOutcomeCode is false for it and true for the 8 known ones", () => {
    const parsed = parseRunLog("failed: 1 processed, 1 errors\nBTBETRETF some_future_code 2026-09-22 x");
    expect(parsed.entries).toEqual([{ kind: "etf", symbol: "BTBETRETF", code: "some_future_code", detail: "2026-09-22 x" }]);
    expect(isKnownOutcomeCode("some_future_code")).toBe(false);
    for (const code of ["ok", "already_ingested", "missing", "fetch_error", "no_adapter", "parse_error", "persist_error", "internal_error"]) {
      expect(isKnownOutcomeCode(code)).toBe(true);
    }
  });

  it("RL-10: a code without report-date support keeps a date-like prefix in its detail; an invalid calendar date for a date-carrying code is kept whole", () => {
    const noDateCode = parseRunLog("failed: 1 processed, 1 errors\nA internal_error 2026-09-22 boom");
    expect(noDateCode.entries).toEqual([{ kind: "etf", symbol: "A", code: "internal_error", detail: "2026-09-22 boom" }]);

    const invalidCalendarDate = parseRunLog("success: 1 processed, 0 errors\nA ok 2026-02-30 x");
    expect(invalidCalendarDate.entries).toEqual([{ kind: "etf", symbol: "A", code: "ok", detail: "2026-02-30 x" }]);
  });

  it("RL-11: CODES_WITH_REPORT_DATE equals the IngestOutcome variants that declare reportDate", () => {
    type WithDate<T> = T extends unknown ? ("reportDate" extends keyof T ? (T extends { code: infer C } ? C : never) : never) : never;
    expectTypeOf<(typeof CODES_WITH_REPORT_DATE)[number]>().toEqualTypeOf<WithDate<IngestOutcome>>();
  });
});
