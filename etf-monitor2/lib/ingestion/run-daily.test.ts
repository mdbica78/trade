import { describe, expect, it, vi } from "vitest";
import type { IngestEtfInput, IngestOutcome } from "./ingest-etf";
import { runDailyIngestion, type DailyEtf } from "./run-daily";

function etf(overrides: Partial<DailyEtf> = {}): DailyEtf {
  return {
    id: 1,
    symbol: "AAA",
    bvbUrl: "https://bvb.ro/AAA",
    adapterKey: "brd-depositary",
    trackedFieldKeys: ["nav_per_unit"],
    isActive: true,
    ...overrides,
  };
}

const okOutcome = (symbol: string): IngestOutcome => ({
  code: "ok",
  symbol,
  reportDate: "2026-09-22",
  valuesWritten: 1,
  sourceUrl: "https://example/x.pdf",
  detail: "stored 1 values",
});

describe("AC2: every active ETF once, inactive never, tracked keys as given by the loader", () => {
  it("RD-2a: processes only active ETFs, in loader order, with their exact tracked keys", async () => {
    const A = etf({ id: 1, symbol: "A", trackedFieldKeys: ["nav_per_unit"] });
    const B = etf({ id: 2, symbol: "B", isActive: false, trackedFieldKeys: ["net_asset"] });
    const C = etf({ id: 3, symbol: "C", trackedFieldKeys: ["units_in_circulation"] });
    const ingest = vi.fn(async (e: IngestEtfInput) => okOutcome(e.symbol));
    const loadEtfs = vi.fn(async () => [A, B, C]);

    const summary = await runDailyIngestion({ loadEtfs, ingest });

    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ingest).toHaveBeenNthCalledWith(1, { id: 1, symbol: "A", bvbUrl: A.bvbUrl, adapterKey: A.adapterKey, trackedFieldKeys: A.trackedFieldKeys });
    expect(ingest).toHaveBeenNthCalledWith(2, { id: 3, symbol: "C", bvbUrl: C.bvbUrl, adapterKey: C.adapterKey, trackedFieldKeys: C.trackedFieldKeys });
    expect(summary.etfs.map((e) => e.symbol)).toEqual(["A", "C"]);
    expect(JSON.stringify(summary)).not.toContain('"B"');
  });

  it("RD-2d: an empty loader result gives an empty summary, ingest never called", async () => {
    const ingest = vi.fn();
    const summary = await runDailyIngestion({ loadEtfs: async () => [], ingest });
    expect(summary).toEqual({ etfs: [] });
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe("AC3: isolation", () => {
  it("RD-3a: a failed outcome, a throw and an ok outcome are all recorded, in order", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });
    const C = etf({ id: 3, symbol: "C" });
    const failedOutcome: IngestOutcome = {
      code: "fetch_error",
      symbol: "A",
      stage: "download",
      kind: "http_error",
      httpStatus: 503,
      detail: "boom-a",
    };
    const ingest = vi.fn(async (e: IngestEtfInput) => {
      if (e.symbol === "A") return failedOutcome;
      if (e.symbol === "B") throw new Error("boom");
      return okOutcome("C");
    });

    const summary = await runDailyIngestion({ loadEtfs: async () => [A, B, C], ingest });

    expect(summary.etfs).toHaveLength(3);
    expect(summary.etfs[0]).toEqual({ symbol: "A", outcome: failedOutcome });
    expect(summary.etfs[0].outcome).toBe(failedOutcome);
    expect(summary.etfs[1]).toEqual({ symbol: "B", outcome: { code: "internal_error", symbol: "B", detail: "boom" } });
    expect(summary.etfs[2].outcome.code).toBe("ok");
  });

  it("RD-3b: a thrown non-Error value becomes internal_error with its String() form", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const ingest = vi.fn(async () => {
      throw "plain string";
    });
    const summary = await runDailyIngestion({ loadEtfs: async () => [A], ingest });
    expect(summary.etfs[0].outcome).toEqual({ code: "internal_error", symbol: "A", detail: "plain string" });
  });

  it("a rejected promise from ingest behaves like a throw", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const ingest = vi.fn(async () => Promise.reject(new Error("rejected")));
    const summary = await runDailyIngestion({ loadEtfs: async () => [A], ingest });
    expect(summary.etfs[0].outcome).toEqual({ code: "internal_error", symbol: "A", detail: "rejected" });
  });
});

describe("AC4: no retries, sequential", () => {
  it("RD-4: ingest is called exactly once per active ETF", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B", isActive: false });
    const C = etf({ id: 3, symbol: "C" });
    const ingest = vi.fn(async (e: IngestEtfInput) => okOutcome(e.symbol));
    await runDailyIngestion({ loadEtfs: async () => [A, B, C], ingest });
    const bySymbol = ingest.mock.calls.map((c) => c[0].symbol);
    expect(bySymbol).toEqual(["A", "C"]);
  });

  it("RD-4b: the second ETF is not started before the first resolves", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });
    let inFlight = 0;
    let maxInFlight = 0;
    const ingest = vi.fn(async (e: IngestEtfInput) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return okOutcome(e.symbol);
    });
    await runDailyIngestion({ loadEtfs: async () => [A, B], ingest });
    expect(maxInFlight).toBe(1);
  });
});
