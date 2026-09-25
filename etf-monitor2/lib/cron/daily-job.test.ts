import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeJobRunStore, fixedClock } from "../../test/helpers/job-run-fakes";
import type { DailyRunSummary } from "../ingestion/run-daily";
import { runDailyJob, STALE_RUN_THRESHOLD_MS } from "./daily-job";

const T0 = new Date("2026-09-25T10:00:05.000Z");
const T1 = new Date("2026-09-25T10:00:41.000Z");

function outcome(symbol: string, code: string, extra: Record<string, unknown> = {}) {
  return { symbol, outcome: { symbol, code, detail: "d", ...extra } as never };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DJ-1: one row per run, correct ordering and finish contents", () => {
  it("DJ-1a: failStaleRuns, startRun, then ingestion, then finishRun, in order", async () => {
    const events: string[] = [];
    const jobRuns = createFakeJobRunStore({ events });
    const runIngestion = async (): Promise<DailyRunSummary> => {
      events.push("loadEtfs");
      events.push("ingest:A");
      events.push("ingest:B");
      return { etfs: [outcome("A", "ok"), outcome("B", "ok")] };
    };

    await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });

    expect(events).toEqual(["failStaleRuns", "startRun", "loadEtfs", "ingest:A", "ingest:B", "finishRun"]);
    expect(jobRuns.calls[1]).toMatchObject({ method: "startRun", args: [T0] });
  });

  it("DJ-1b: finishRun receives the started row's id and the computed fields", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => ({ etfs: [outcome("A", "ok")] });

    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });

    expect(result).toMatchObject({ kind: "finished", jobRunId: 1, status: "success" });
    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    expect(finishCall).toMatchObject({
      method: "finishRun",
      args: [1, { finishedAt: T1, status: "success", etfsProcessed: 1, errorsCount: 0 }],
    });
    const row = jobRuns.rows.get(1)!;
    expect(row.status).not.toBe("running");
    expect(row.finishedAt).not.toBeNull();
  });
});

describe("DJ-2: status and counts", () => {
  const cases: [string, ReturnType<typeof outcome>[], string, number, number][] = [
    ["all ok", [outcome("A", "ok"), outcome("B", "ok"), outcome("C", "ok")], "success", 3, 0],
    [
      "all already_ingested",
      [outcome("A", "already_ingested"), outcome("B", "already_ingested"), outcome("C", "already_ingested")],
      "success",
      3,
      0,
    ],
    ["zero active ETFs", [], "success", 0, 0],
    [
      "mix ok/fetch_error/already_ingested",
      [outcome("A", "ok"), outcome("B", "fetch_error"), outcome("C", "already_ingested")],
      "partial",
      3,
      1,
    ],
    [
      "all failures incl. internal_error",
      [outcome("A", "missing"), outcome("B", "no_adapter"), outcome("C", "internal_error")],
      "failed",
      3,
      3,
    ],
  ];

  for (const [name, etfs, status, etfsProcessed, errorsCount] of cases) {
    it(`DJ-2: ${name} -> ${status}, ${etfsProcessed}, ${errorsCount}`, async () => {
      const jobRuns = createFakeJobRunStore();
      const runIngestion = async (): Promise<DailyRunSummary> => ({ etfs: etfs as DailyRunSummary["etfs"] });
      const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
      expect(result).toMatchObject({ kind: "finished", status, etfs: expect.any(Array) });
      const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
      expect(finishCall).toMatchObject({ args: [expect.any(Number), { status, etfsProcessed, errorsCount }] });
    });
  }

  it("DJ-2e: a finished, all-failed run still reports kind 'finished' (handler answers 200, not 500)", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => ({
      etfs: [outcome("A", "missing"), outcome("B", "no_adapter"), outcome("C", "internal_error")],
    });
    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    expect(result.kind).toBe("finished");
  });
});

describe("DJ-5: abort handling", () => {
  it("DJ-5a: the ETF query throws after the row exists -> failed row, aborted result, ingest never called", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => {
      throw new Error('relation "etfs" does not exist');
    };
    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    expect(result).toMatchObject({ kind: "aborted", jobRunId: 1, status: "failed" });
    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    expect(finishCall?.args[1]).toMatchObject({
      status: "failed",
      etfsProcessed: 0,
      errorsCount: 0,
      log: 'failed: 0 processed, 0 errors\nrun aborted: relation "etfs" does not exist',
    });
  });

  it("DJ-5b: runIngestion rejects with a non-Error value", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => {
      throw "plain";
    };
    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    expect(result).toMatchObject({ kind: "aborted", status: "failed" });
    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    expect((finishCall?.args[1] as { log: string }).log.endsWith("run aborted: plain")).toBe(true);
  });

  it("DJ-5c: failStaleRuns rejects -> runDailyJob rejects, nothing else is called", async () => {
    const jobRuns = createFakeJobRunStore({ failOn: "failStaleRuns" });
    const runIngestion = vi.fn(async (): Promise<DailyRunSummary> => ({ etfs: [] }));
    await expect(
      runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] }),
    ).rejects.toThrow("failStaleRuns failed");
    expect(jobRuns.calls.map((c) => c.method)).toEqual(["failStaleRuns"]);
    expect(runIngestion).not.toHaveBeenCalled();
  });

  it("DJ-5d: startRun rejects -> runDailyJob rejects; failStaleRuns was called once, nothing after", async () => {
    const jobRuns = createFakeJobRunStore({ failOn: "startRun" });
    const runIngestion = vi.fn(async (): Promise<DailyRunSummary> => ({ etfs: [] }));
    await expect(
      runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] }),
    ).rejects.toThrow("startRun failed");
    expect(jobRuns.calls.map((c) => c.method)).toEqual(["failStaleRuns", "startRun"]);
    expect(runIngestion).not.toHaveBeenCalled();
  });

  it("DJ-5e: finishRun rejects after a normal run -> resolves aborted, does not throw, finishRun called exactly once", async () => {
    const jobRuns = createFakeJobRunStore({ failOn: "finishRun" });
    const runIngestion = async (): Promise<DailyRunSummary> => ({ etfs: [outcome("A", "ok")] });
    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    expect(result).toMatchObject({ kind: "aborted", jobRunId: 1, status: "failed" });
    expect(jobRuns.calls.filter((c) => c.method === "finishRun")).toHaveLength(1);
  });
});

describe("DJ-6: stale-run sweep wiring", () => {
  it("DJ-6a: failStaleRuns is called once, with exactly startedAt - STALE_RUN_THRESHOLD_MS, before startRun", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => ({ etfs: [] });
    await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    const sweepCall = jobRuns.calls[0];
    expect(sweepCall).toMatchObject({
      method: "failStaleRuns",
      args: [new Date(T0.getTime() - STALE_RUN_THRESHOLD_MS)],
    });
    expect(jobRuns.calls[1].method).toBe("startRun");
  });
});

describe("DJ-7: returned jobRunId and status", () => {
  it("jobRunId equals the id startRun returned, status equals the finishRun status", async () => {
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => ({ etfs: [outcome("A", "fetch_error")] });
    const result = await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [] });
    expect(result).toMatchObject({ kind: "finished", jobRunId: 1, status: "failed" });
  });
});

describe("secrets never reach the stored log", () => {
  it("a secret embedded in an outcome detail is redacted in the log passed to finishRun", async () => {
    const secret = "cron-secret-value";
    const jobRuns = createFakeJobRunStore();
    const runIngestion = async (): Promise<DailyRunSummary> => ({
      etfs: [outcome("A", "persist_error", { detail: `write failed: ${secret}` })],
    });
    await runDailyJob({ now: fixedClock(T0, T1), jobRuns, runIngestion, secrets: [secret] });
    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    const log = (finishCall?.args[1] as { log: string }).log;
    expect(log).not.toContain(secret);
  });
});
