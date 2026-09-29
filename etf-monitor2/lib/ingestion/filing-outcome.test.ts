import { describe, expect, it } from "vitest";
import { combineFilingOutcomes } from "./filing-outcome";
import type { IngestOutcome } from "./outcome";

const ok = (reportDate: string, valuesWritten: number, sourceUrl = `https://x/${reportDate}.pdf`): IngestOutcome => ({
  code: "ok",
  symbol: "AAA",
  reportDate,
  valuesWritten,
  sourceUrl,
  detail: "irrelevant",
});

const alreadyIngested = (reportDate: string): IngestOutcome => ({
  code: "already_ingested",
  symbol: "AAA",
  reportDate,
  detail: "irrelevant",
});

const notAttempted = (): IngestOutcome => ({ code: "not_attempted", symbol: "AAA", detail: "irrelevant" });

const failure = (detail: string): IngestOutcome => ({
  code: "fetch_error",
  symbol: "AAA",
  stage: "download",
  kind: "network",
  detail,
});

describe("combineFilingOutcomes (US-037 D-2)", () => {
  it("FO-1: an empty outcome list is an internal error", () => {
    const result = combineFilingOutcomes("AAA", [], false);
    expect(result).toEqual({ code: "internal_error", symbol: "AAA", detail: "internal error: no report link" });
  });

  it("FO-2: counts come first, in stored/already-stored/failed/not-attempted order", () => {
    const result = combineFilingOutcomes("AAA", [ok("2026-09-20", 3), alreadyIngested("2026-09-19")], false);
    expect(result.detail.startsWith("stored 1, already stored 1, failed 0, not attempted 0;")).toBe(true);
  });

  it("FO-3: truncated is appended to the counts", () => {
    const result = combineFilingOutcomes("AAA", [ok("2026-09-20", 1)], true);
    expect(result.detail.startsWith("stored 1, already stored 0, failed 0, not attempted 0, truncated;")).toBe(true);
  });

  it("FO-4: priority 1 — the first failure in processing order wins over ok and not_attempted", () => {
    const result = combineFilingOutcomes("AAA", [ok("2026-09-20", 1), failure("download network: boom"), notAttempted()], false);
    expect(result.code).toBe("fetch_error");
    expect(result.detail).toBe("stored 1, already stored 0, failed 1, not attempted 1; download network: boom");
  });

  it("FO-5: priority 2 — any not_attempted wins over ok when there is no failure", () => {
    const result = combineFilingOutcomes("AAA", [ok("2026-09-20", 1), notAttempted()], false);
    expect(result).toEqual({
      code: "not_attempted",
      symbol: "AAA",
      detail: "stored 1, already stored 0, failed 0, not attempted 1; run time limit: remaining reports not downloaded before the deadline",
    });
  });

  it("FO-6: priority 3 — ok wins over already_ingested, reportDate is the greatest, valuesWritten sums every ok", () => {
    const result = combineFilingOutcomes(
      "AAA",
      [ok("2026-09-19", 2, "https://x/19.pdf"), ok("2026-09-20", 5, "https://x/20.pdf"), alreadyIngested("2026-09-18")],
      false,
    );
    expect(result).toEqual({
      code: "ok",
      symbol: "AAA",
      reportDate: "2026-09-20",
      sourceUrl: "https://x/20.pdf",
      valuesWritten: 7,
      detail: "stored 2, already stored 1, failed 0, not attempted 0; 7 values written",
    });
  });

  it("FO-6b: a tie on reportDate goes to the first processed", () => {
    const result = combineFilingOutcomes(
      "AAA",
      [ok("2026-09-20", 1, "https://x/first.pdf"), ok("2026-09-20", 1, "https://x/second.pdf")],
      false,
    );
    expect(result).toMatchObject({ reportDate: "2026-09-20", sourceUrl: "https://x/first.pdf" });
  });

  it("FO-7: priority 4 — every outcome already_ingested, reportDate from the first (newest) link", () => {
    const result = combineFilingOutcomes("AAA", [alreadyIngested("2026-09-20"), alreadyIngested("2026-09-19")], false);
    expect(result).toEqual({
      code: "already_ingested",
      symbol: "AAA",
      reportDate: "2026-09-20",
      detail: "stored 0, already stored 2, failed 0, not attempted 0",
    });
  });

  it("FO-8: the combined detail is always one line, even from a multi-line failure detail", () => {
    const result = combineFilingOutcomes("AAA", [failure("download network: line one\nline two")], false);
    expect(result.detail).not.toContain("\n");
  });
});
