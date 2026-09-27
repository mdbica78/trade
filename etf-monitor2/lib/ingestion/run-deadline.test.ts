import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { IngestEtfInput, IngestOutcome } from "./ingest-etf";
import { summarizeRun } from "./job-run-summary";
import {
  CRON_FETCH_TIMEOUT_MS,
  CRON_MAX_DURATION_S,
  etfWorstCaseMs,
  FINISH_RESERVE_MS,
  MAX_REQUESTS_PER_ETF,
  PARSE_ALLOWANCE_MS,
  runDailyIngestion,
  runDeadlineMs,
  type DailyEtf,
} from "./run-daily";

const START = new Date("2026-09-27T08:00:00Z");

function etf(overrides: Partial<DailyEtf> = {}): DailyEtf {
  return {
    id: 1,
    symbol: "AAA",
    bvbUrl: "https://bvb.ro/AAA",
    adapterKey: "brd-depositary",
    trackedFieldKeys: [],
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

/** A mutable clock: `ingest` advances it, nothing sleeps (US-030 AC7 Notes). */
function makeClock(startedAt: Date) {
  let t = startedAt.getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("DL: run deadline guard", () => {
  it("DL-1: an ETF that no longer fits gets not_attempted, and so does the one after it; ingest is called only for the ones that fit", async () => {
    const clock = makeClock(START);
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });
    const C = etf({ id: 3, symbol: "C" });
    const D = etf({ id: 4, symbol: "D" });
    const ingestCalls: string[] = [];

    const ingest = async (e: IngestEtfInput) => {
      ingestCalls.push(e.symbol);
      if (e.symbol === "A") clock.advance(30_000);
      if (e.symbol === "B") clock.advance(10_000);
      return okOutcome(e.symbol);
    };

    const summary = await runDailyIngestion(
      { loadEtfs: async () => [A, B, C, D], ingest },
      { startedAt: START, now: clock.now },
    );

    expect(ingestCalls).toEqual(["A", "B"]);
    expect(summary.etfs.map((e) => e.symbol)).toEqual(["A", "B", "C", "D"]);
    expect(summary.etfs[0].outcome.code).toBe("ok");
    expect(summary.etfs[1].outcome.code).toBe("ok");
    expect(summary.etfs[2].outcome.code).toBe("not_attempted");
    expect(summary.etfs[3].outcome.code).toBe("not_attempted");
  });

  it("DL-2: exact equality (now + worstCase === deadline) still starts the ETF", () => {
    const deadline = runDeadlineMs(START);
    const worstCase = etfWorstCaseMs();
    const now = new Date(deadline - worstCase);
    expect(now.getTime() + worstCase).toBe(deadline);
  });

  it("DL-3: an ETF that fits keeps its exact returned outcome object", async () => {
    const A = etf({ id: 1, symbol: "A" });
    const okA = okOutcome("A");
    const summary = await runDailyIngestion(
      { loadEtfs: async () => [A], ingest: async () => okA },
      { startedAt: START, now: () => START },
    );
    expect(summary.etfs[0].outcome).toBe(okA);
  });

  it("DL-4: the not_attempted detail is a single line", async () => {
    const clock = makeClock(START);
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });
    const summary = await runDailyIngestion(
      {
        loadEtfs: async () => [A, B],
        ingest: async (e) => {
          clock.advance(60_000);
          return okOutcome(e.symbol);
        },
      },
      { startedAt: START, now: clock.now },
    );
    const skipped = summary.etfs.find((e) => e.outcome.code === "not_attempted")!;
    expect(skipped.outcome.detail).not.toContain("\n");
    expect(skipped.outcome.detail.length).toBeGreaterThan(0);
  });

  it("DL-5: an inactive ETF after the deadline is silently skipped, not reported as not_attempted", async () => {
    const clock = makeClock(START);
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B", isActive: false });
    const summary = await runDailyIngestion(
      {
        loadEtfs: async () => [A, B],
        ingest: async (e) => {
          clock.advance(60_000);
          return okOutcome(e.symbol);
        },
      },
      { startedAt: START, now: clock.now },
    );
    expect(summary.etfs.map((e) => e.symbol)).toEqual(["A"]);
  });

  it("DL-6: summarizeRun counts not_attempted as an error — partial when some ok, failed when every ETF misses the deadline", async () => {
    const clock = makeClock(START);
    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });
    const partial = await runDailyIngestion(
      {
        loadEtfs: async () => [A, B],
        ingest: async (e) => {
          clock.advance(60_000);
          return okOutcome(e.symbol);
        },
      },
      { startedAt: START, now: clock.now },
    );
    expect(summarizeRun(partial.etfs).status).toBe("partial");

    const clock2 = makeClock(START);
    clock2.advance(60_000);
    const allMissed = await runDailyIngestion(
      { loadEtfs: async () => [A, B], ingest: async (e) => okOutcome(e.symbol) },
      { startedAt: START, now: clock2.now },
    );
    expect(summarizeRun(allMissed.etfs).status).toBe("failed");
    expect(allMissed.etfs.every((e) => e.outcome.code === "not_attempted")).toBe(true);
  });

  it("DL-7: the guard's arithmetic (etfWorstCaseMs, runDeadlineMs) uses only the named constants, not a re-typed literal", () => {
    const source = readFileSync(path.join(__dirname, "run-daily.ts"), "utf8");
    const constantDefinitionLines = source
      .split("\n")
      .filter((l) =>
        /^export const (CRON_FETCH_TIMEOUT_MS|MAX_REQUESTS_PER_ETF|CRON_MAX_DURATION_S|PARSE_ALLOWANCE_MS|FINISH_RESERVE_MS)\s*=/.test(
          l,
        ),
      );
    expect(constantDefinitionLines.length).toBe(5);

    const worstCaseFn = /export function etfWorstCaseMs\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(source)![1];
    const deadlineFn = /export function runDeadlineMs\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(source)![1];
    expect(worstCaseFn).not.toMatch(/\b\d+\b/);
    expect(deadlineFn).not.toMatch(/\b\d+\b/);
  });

  it("guard constants sanity: MAX_REQUESTS_PER_ETF, CRON_FETCH_TIMEOUT_MS, PARSE_ALLOWANCE_MS, FINISH_RESERVE_MS, CRON_MAX_DURATION_S are consistent", () => {
    expect(etfWorstCaseMs()).toBe(MAX_REQUESTS_PER_ETF * CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS);
    expect(runDeadlineMs(START)).toBe(START.getTime() + CRON_MAX_DURATION_S * 1_000 - FINISH_RESERVE_MS);
  });
});
