import { describe, expect, it } from "vitest";
import { INGEST_OUTCOME_CODES, type IngestOutcome } from "./outcome";
import {
  formatAbortedRunLog,
  formatRunLog,
  isErrorOutcome,
  MAX_LOG_DETAIL_LENGTH,
  redactSecrets,
  SUCCESS_OUTCOME_CODES,
  summarizeRun,
  truncateDetail,
} from "./job-run-summary";

function outcome(code: string, extra: Record<string, unknown> = {}) {
  return { symbol: "X", code, detail: "d", ...extra };
}

describe("JS-3: every failure code counts, success codes do not", () => {
  it("JS-3a: every INGEST_OUTCOME_CODES + internal_error code is classified, unknown codes fall on the error side", () => {
    const successCodes = ["ok", "already_ingested"];
    const errorCodes = ["missing", "fetch_error", "no_adapter", "parse_error", "persist_error", "internal_error"];

    for (const code of successCodes) {
      expect(isErrorOutcome(code), `${code} should be success`).toBe(false);
    }
    for (const code of errorCodes) {
      expect(isErrorOutcome(code), `${code} should be error`).toBe(true);
    }

    // anti-vacuity: every real outcome code plus internal_error is covered by one of the two lists
    for (const code of [...INGEST_OUTCOME_CODES, "internal_error"]) {
      expect(successCodes.includes(code) || errorCodes.includes(code), `${code} not classified in this test`).toBe(
        true,
      );
    }
    expect(SUCCESS_OUTCOME_CODES).toEqual(["ok", "already_ingested"]);
  });

  it("JS-3b: an unrecognised future code counts as an error", () => {
    expect(isErrorOutcome("some_future_code")).toBe(true);
    const result = summarizeRun([
      { symbol: "A", outcome: outcome("ok") as never },
      { symbol: "B", outcome: outcome("some_future_code") as never },
    ]);
    expect(result).toEqual({ status: "partial", etfsProcessed: 2, errorsCount: 1 });
  });

  it("JS-3c: summarizeRun on real IngestOutcome values (ok, internal_error) gives partial", () => {
    const okOutcome: IngestOutcome = { code: "ok", symbol: "A", reportDate: "2026-09-22", valuesWritten: 2, sourceUrl: "https://x", detail: "d" };
    const internalErrorOutcome: IngestOutcome = { code: "internal_error", symbol: "B", detail: "internal error: boom" };
    const result = summarizeRun([
      { symbol: "A", outcome: okOutcome },
      { symbol: "B", outcome: internalErrorOutcome },
    ]);
    expect(result).toEqual({ status: "partial", etfsProcessed: 2, errorsCount: 1 });
  });
});

describe("JS-2: status and counts", () => {
  it("all ok -> success", () => {
    const etfs = [outcome("ok"), outcome("ok"), outcome("ok")].map((o, i) => ({ symbol: `E${i}`, outcome: o as never }));
    expect(summarizeRun(etfs)).toEqual({ status: "success", etfsProcessed: 3, errorsCount: 0 });
  });

  it("all already_ingested -> success", () => {
    const etfs = [outcome("already_ingested"), outcome("already_ingested")].map((o, i) => ({
      symbol: `E${i}`,
      outcome: o as never,
    }));
    expect(summarizeRun(etfs)).toEqual({ status: "success", etfsProcessed: 2, errorsCount: 0 });
  });

  it("zero ETFs -> success 0/0", () => {
    expect(summarizeRun([])).toEqual({ status: "success", etfsProcessed: 0, errorsCount: 0 });
  });

  it("mixed ok and failures -> partial", () => {
    const etfs = [outcome("ok"), outcome("fetch_error"), outcome("already_ingested")].map((o, i) => ({
      symbol: `E${i}`,
      outcome: o as never,
    }));
    expect(summarizeRun(etfs)).toEqual({ status: "partial", etfsProcessed: 3, errorsCount: 1 });
  });

  it("all failures -> failed", () => {
    const etfs = [outcome("missing"), outcome("no_adapter"), outcome("internal_error")].map((o, i) => ({
      symbol: `E${i}`,
      outcome: o as never,
    }));
    expect(summarizeRun(etfs)).toEqual({ status: "failed", etfsProcessed: 3, errorsCount: 3 });
  });

  it("boundary: 1 of 1 failed -> failed, 1 of 2 failed -> partial", () => {
    expect(summarizeRun([{ symbol: "A", outcome: outcome("missing") as never }])).toMatchObject({ status: "failed" });
    expect(
      summarizeRun([
        { symbol: "A", outcome: outcome("missing") as never },
        { symbol: "B", outcome: outcome("ok") as never },
      ]),
    ).toMatchObject({ status: "partial" });
  });
});

describe("JS-4: log format", () => {
  it("JS-4a: exact log text, one line per ETF in processing order, no trailing newline", () => {
    const etfs = [
      { symbol: "AAA", outcome: outcome("ok", { reportDate: "2026-09-22", detail: "stored 8 values" }) as never },
      {
        symbol: "BBB",
        outcome: outcome("fetch_error", { detail: "download http_error 404: https://example.test/x.pdf" }) as never,
      },
      {
        symbol: "CCC",
        outcome: outcome("parse_error", { reportDate: "2026-09-22", detail: "missing fields: nav_per_unit" }) as never,
      },
    ];
    const result = summarizeRun(etfs);
    const log = formatRunLog(etfs, result, []);
    expect(log).toBe(
      [
        "partial: 3 processed, 2 errors",
        "AAA ok 2026-09-22 stored 8 values",
        "BBB fetch_error download http_error 404: https://example.test/x.pdf",
        "CCC parse_error 2026-09-22 missing fields: nav_per_unit",
      ].join("\n"),
    );
    expect(log.endsWith("\n")).toBe(false);
  });

  it("JS-4b: the date is shown only when known", () => {
    const etfs = [
      { symbol: "A", outcome: outcome("already_ingested", { reportDate: "2026-09-22", detail: "report already stored" }) as never },
      { symbol: "B", outcome: outcome("no_adapter", { detail: "no adapter registered" }) as never },
      { symbol: "C", outcome: outcome("missing", { detail: "no report entries" }) as never },
      { symbol: "D", outcome: outcome("persist_error", { detail: "write failed" }) as never },
      { symbol: "E", outcome: outcome("persist_error", { reportDate: "2026-09-22", detail: "write failed" }) as never },
    ];
    const result = summarizeRun(etfs);
    const lines = formatRunLog(etfs, result, []).split("\n").slice(1);
    expect(lines).toEqual([
      "A already_ingested 2026-09-22 report already stored",
      "B no_adapter no adapter registered",
      "C missing no report entries",
      "D persist_error write failed",
      "E persist_error 2026-09-22 write failed",
    ]);
  });

  it("JS-4c: truncation at exactly MAX_LOG_DETAIL_LENGTH, cut adds ...", () => {
    const exact = "x".repeat(MAX_LOG_DETAIL_LENGTH);
    const over = "x".repeat(MAX_LOG_DETAIL_LENGTH + 1);
    expect(truncateDetail(exact)).toBe(exact);
    expect(truncateDetail(exact).length).toBe(MAX_LOG_DETAIL_LENGTH);
    const cut = truncateDetail(over);
    expect(cut.length).toBe(MAX_LOG_DETAIL_LENGTH);
    expect(cut.endsWith("...")).toBe(true);
    expect(cut.slice(0, MAX_LOG_DETAIL_LENGTH - 3)).toBe("x".repeat(MAX_LOG_DETAIL_LENGTH - 3));
  });

  it("JS-4c: the limit applies to the detail, not to symbol or code", () => {
    const longSymbol = "S".repeat(500);
    const etfs = [{ symbol: longSymbol, outcome: outcome("ok", { detail: "short" }) as never }];
    const line = formatRunLog(etfs, summarizeRun(etfs), []).split("\n")[1];
    expect(line.startsWith(longSymbol)).toBe(true);
  });

  it("JS-4d: whitespace (including newlines/tabs) in a detail is collapsed to one line", () => {
    const etfs = [
      { symbol: "A", outcome: outcome("internal_error", { detail: "line1\nline2\tindented\n\nline3" }) as never },
      { symbol: "B", outcome: outcome("ok", { detail: "fine" }) as never },
    ];
    const log = formatRunLog(etfs, summarizeRun(etfs), []);
    expect(log.split("\n")).toHaveLength(1 + etfs.length);
  });

  it("JS-4e: secrets are redacted, including one that straddles the truncation boundary, before collapsing/truncation", () => {
    const secret = "SECRET-VALUE-12345";
    const padding = "a".repeat(MAX_LOG_DETAIL_LENGTH - 10);
    const detail = `${padding}${secret}`;
    const etfs = [{ symbol: "A", outcome: outcome("persist_error", { detail }) as never }];
    const log = formatRunLog(etfs, summarizeRun(etfs), [secret]);
    expect(log).not.toContain(secret);
    expect(log).toContain("[redacted]");
  });

  it("formatAbortedRunLog produces the fixed 0/0 summary plus the redacted, truncated error text", () => {
    const secret = "top-secret";
    const log = formatAbortedRunLog(new Error(`boom ${secret}`), [secret]);
    expect(log).toBe("failed: 0 processed, 0 errors\nrun aborted: boom [redacted]");
  });

  it("formatAbortedRunLog never throws on a non-Error value", () => {
    expect(() => formatAbortedRunLog("plain", [])).not.toThrow();
    expect(formatAbortedRunLog("plain", [])).toBe("failed: 0 processed, 0 errors\nrun aborted: plain");
  });
});

describe("redactSecrets", () => {
  it("replaces every exact non-empty occurrence, ignores empty secrets", () => {
    expect(redactSecrets("a-b-a", ["a"])).toBe("[redacted]-b-[redacted]");
    expect(redactSecrets("hello", [""])).toBe("hello");
  });
});
