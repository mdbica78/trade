import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissingDatabaseUrlError } from "../db/index";
import { runDailyIngestion } from "../ingestion/run-daily";
import { createFakeJobRunStore, fixedClock } from "../../test/helpers/job-run-fakes";
import { runDailyJob } from "./daily-job";
import { handleDailyCron as handleGatedDailyCron, type CronEnv, type DailyCronDeps } from "./daily-handler";

/** Most tests here are about auth/responses, not the schedule gate: they run well past the default hour. */
type TestDeps = Omit<DailyCronDeps, "now" | "readCronHour"> & Partial<Pick<DailyCronDeps, "now" | "readCronHour">>;

function handleDailyCron(request: Request, deps: TestDeps): Promise<Response> {
  return handleGatedDailyCron(request, {
    now: () => new Date("2026-10-09T12:00:00Z"),
    readCronHour: async () => 10,
    ...deps,
  });
}

const SECRET = "s3cr3t-Token-For-Tests-42";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/cron/daily", { headers });
}

function env(overrides: Partial<CronEnv> = {}): CronEnv {
  return { cronSecret: SECRET, databaseUrl: "postgresql://user:pw@ep-fake.neon.tech/db", ...overrides };
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
  vi.unstubAllEnvs();
});

describe("US-062 (DEC-030): the schedule gate", () => {
  function gated(overrides: { hour?: number; at?: string; run?: DailyCronDeps["run"]; readCronHour?: DailyCronDeps["readCronHour"] } = {}) {
    const run =
      overrides.run ??
      vi.fn(async () => ({ kind: "finished" as const, jobRunId: 1, status: "success" as const, etfs: [] }));
    const readCronHour = overrides.readCronHour ?? vi.fn(async () => overrides.hour ?? 10);
    const deps: DailyCronDeps = {
      readEnv: () => env(),
      now: () => new Date(overrides.at ?? "2026-10-09T10:00:00Z"),
      readCronHour,
      run,
    };
    return { deps, run, readCronHour };
  }
  const authorized = () => request({ authorization: `Bearer ${SECRET}` });

  it("GT-1: before the configured hour -> 200 skipped/not_scheduled_hour, no-store, run never called", async () => {
    const { deps, run } = gated({ at: "2026-10-09T09:59:59Z", hour: 10 });
    const response = await handleGatedDailyCron(authorized(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ skipped: "not_scheduled_hour" });
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ["at the hour", "2026-10-09T10:00:00Z", 10],
    ["after the hour (catch-up)", "2026-10-09T17:45:00Z", 10],
    ["hour 0 at any time", "2026-10-09T00:00:00Z", 0],
    ["hour 23 at 23:59", "2026-10-09T23:59:59Z", 23],
  ])("GT-2: %s runs the job", async (_label, at, hour) => {
    const { deps, run } = gated({ at, hour });
    const response = await handleGatedDailyCron(authorized(), deps);
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("GT-3: hour 23 does not run at 22:59; the gate compares UTC hours, not the process time zone", async () => {
    const { deps, run } = gated({ at: "2026-10-09T22:59:59Z", hour: 23 });
    expect(await (await handleGatedDailyCron(authorized(), deps)).json()).toEqual({ skipped: "not_scheduled_hour" });
    expect(run).not.toHaveBeenCalled();
  });

  it("GT-4: a lost claim (already ran today, any status) -> 200 skipped/already_ran, no-store", async () => {
    const run = vi.fn(async () => ({ kind: "skipped" as const, reason: "already_ran" as const }));
    const { deps } = gated({ run });
    const response = await handleGatedDailyCron(authorized(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ skipped: "already_ran" });
  });

  it.each([
    ["no header", {}],
    ["wrong secret", { authorization: "Bearer not-the-secret" }],
  ])("GT-5: unauthorized (%s) -> 401 before the schedule is read or the clock is consulted", async (_label, headers) => {
    const { deps, run, readCronHour } = gated();
    const now = vi.fn(deps.now);
    const response = await handleGatedDailyCron(request(headers), { ...deps, now });
    expect(response.status).toBe(401);
    expect(readCronHour).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("GT-6: no CRON_SECRET configured -> 500 before the schedule is read", async () => {
    const { deps, readCronHour } = gated();
    const response = await handleGatedDailyCron(authorized(), { ...deps, readEnv: () => env({ cronSecret: undefined }) });
    expect(response.status).toBe(500);
    expect(readCronHour).not.toHaveBeenCalled();
  });

  it("GT-7: the schedule read failing -> generic 500 'run could not start', no run, no raw error text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const readCronHour = vi.fn(async () => {
      throw new Error(`connection refused ${env().databaseUrl}`);
    });
    const { deps, run } = gated({ readCronHour });
    const response = await handleGatedDailyCron(authorized(), deps);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "run could not start" });
    expect(text).not.toContain("connection refused");
    expect(run).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("AC1: auth", () => {
  const badHeaders: [string, Record<string, string>][] = [
    ["H-1a: no Authorization header", {}],
    ["H-1b: wrong scheme", { authorization: `Basic ${SECRET}` }],
    ["H-1c: wrong secret", { authorization: "Bearer wrong" }],
    ["H-1d: lower-case scheme", { authorization: `bearer ${SECRET}` }],
  ];

  for (const [name, headers] of badHeaders) {
    it(`${name} -> 401, run never called`, async () => {
      const run = vi.fn();
      const response = await handleDailyCron(request(headers), { readEnv: () => env(), run });
      expect(response.status).toBe(401);
      expect(run).not.toHaveBeenCalled();
    });
  }

  it("H-1e: a trailing space in the header value is stripped by the platform's Headers implementation before it reaches us, so it authenticates like the correct bearer (verified directly against the real Request/Headers API, not just this handler)", async () => {
    const run = vi.fn(async () => ({ kind: "finished" as const, jobRunId: 1, status: "success" as const, etfs: [] }));
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET} ` }), { readEnv: () => env(), run });
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("H-15a: composed with runDailyJob, neither the job-run store nor loadEtfs/ingest is called on bad auth", async () => {
    const loadEtfs = vi.fn();
    const ingest = vi.fn();
    const jobRuns = createFakeJobRunStore();
    const deps: TestDeps = {
      readEnv: () => env(),
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns,
          runIngestion: (ctx) => runDailyIngestion({ loadEtfs, ingest }, { startedAt: ctx.startedAt, now: () => ctx.startedAt }),
          secrets: ctx.secrets,
        }),
    };
    const response = await handleDailyCron(request({ authorization: "Bearer wrong" }), deps);
    expect(response.status).toBe(401);
    expect(loadEtfs).not.toHaveBeenCalled();
    expect(ingest).not.toHaveBeenCalled();
    expect(jobRuns.calls).toHaveLength(0);
  });

  it("H-15a: the same composition never touches the job-run store on a missing header or on 500 cron not configured", async () => {
    const jobRuns1 = createFakeJobRunStore();
    const deps1: TestDeps = {
      readEnv: () => env(),
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns: jobRuns1,
          runIngestion: async () => ({ etfs: [] }),
          secrets: ctx.secrets,
        }),
    };
    await handleDailyCron(request(), deps1);
    expect(jobRuns1.calls).toHaveLength(0);

    const jobRuns2 = createFakeJobRunStore();
    const deps2: TestDeps = {
      readEnv: () => env({ cronSecret: undefined }),
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns: jobRuns2,
          runIngestion: async () => ({ etfs: [] }),
          secrets: ctx.secrets,
        }),
    };
    await handleDailyCron(request({ authorization: "Bearer " }), deps2);
    expect(jobRuns2.calls).toHaveLength(0);
  });

  it("H-1g: the correct bearer runs the job and returns 200", async () => {
    const run = vi.fn(async () => ({ kind: "finished" as const, jobRunId: 1, status: "success" as const, etfs: [] }));
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(run).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it.each([undefined, "", "   "])("H-1h: CRON_SECRET %j gives 500 cron not configured, run never called", async (cronSecret) => {
    const run = vi.fn();
    for (const authorization of ["Bearer ", "Bearer undefined"]) {
      const response = await handleDailyCron(request({ authorization }), { readEnv: () => env({ cronSecret }), run });
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "cron not configured" });
    }
    expect(run).not.toHaveBeenCalled();
  });
});

describe("AC3/AC6: responses", () => {
  it("H-3c / H-6a: a completed run with mixed outcomes gives 200 with every entry and the job run id/status", async () => {
    const result = {
      kind: "finished" as const,
      jobRunId: 1,
      status: "partial" as const,
      etfs: [
        {
          symbol: "A",
          outcome: { code: "ok" as const, symbol: "A", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "x", detail: "stored 1 values" },
        },
        { symbol: "B", outcome: { code: "internal_error" as const, symbol: "B", detail: "boom" } },
        {
          symbol: "C",
          outcome: { code: "fetch_error" as const, symbol: "C", stage: "download" as const, kind: "network" as const, detail: "no" },
        },
      ],
    };
    const run = vi.fn(async () => result);
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.jobRunId).toBe(1);
    expect(body.status).toBe("partial");
    expect(body.etfs).toHaveLength(3);
    expect(body.etfs.map((e: { symbol: string }) => e.symbol)).toEqual(["A", "B", "C"]);
  });

  it("H-6b: run rejecting with MissingDatabaseUrlError gives 500 run could not start, no message leaked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => {
      throw new MissingDatabaseUrlError();
    });
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "run could not start" });
    spy.mockRestore();
  });

  it("H-6b: run rejecting with a generic error (ETF query failed) gives the same 500 shape", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => {
      throw new Error('relation "etfs" does not exist');
    });
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "run could not start" });
    spy.mockRestore();
  });

  it("H-6c: no response body ever contains CRON_SECRET or DATABASE_URL, even when an outcome message contains them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testEnv = env({ cronSecret: SECRET, databaseUrl: "postgresql://user:pw-XYZ@ep-fake.neon.tech/db" });
    const dirtySummary = {
      kind: "finished" as const,
      jobRunId: 1,
      status: "partial" as const,
      etfs: [
        {
          symbol: "A",
          outcome: {
            code: "fetch_error" as const,
            symbol: "A",
            stage: "download" as const,
            kind: "network" as const,
            detail: `leaked ${testEnv.cronSecret} and ${testEnv.databaseUrl}`,
          },
        },
        { symbol: "B", outcome: { code: "internal_error" as const, symbol: "B", detail: `also ${testEnv.databaseUrl}` } },
      ],
    };

    const assertNoSecrets = async (response: Response) => {
      const text = await response.text();
      expect(text).not.toContain(testEnv.cronSecret);
      expect(text).not.toContain(testEnv.databaseUrl);
    };

    // 200 with dirty outcome messages
    await assertNoSecrets(
      await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), {
        readEnv: () => testEnv,
        run: async () => dirtySummary,
      }),
    );
    const okBody = await (
      await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => testEnv, run: async () => dirtySummary })
    ).text();
    expect(okBody).toContain("[redacted]");

    // 401
    await assertNoSecrets(
      await handleDailyCron(request({ authorization: "Bearer wrong" }), { readEnv: () => testEnv, run: async () => dirtySummary }),
    );

    // 500 not configured
    await assertNoSecrets(
      await handleDailyCron(request({ authorization: "Bearer " }), {
        readEnv: () => ({ ...testEnv, cronSecret: undefined }),
        run: async () => dirtySummary,
      }),
    );

    // 500 run could not start, with a secret-laden error message
    await assertNoSecrets(
      await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), {
        readEnv: () => testEnv,
        run: async () => {
          throw new Error(`connection failed: ${testEnv.databaseUrl}`);
        },
      }),
    );
    spy.mockRestore();
  });

  it("H-15b: with CRON_SECRET and DATABASE_URL actually set in the environment (real readEnv), neither reaches the stored job-run log or the response", async () => {
    const dbUrl = "postgresql://user:pw-XYZ@ep-fake.neon.tech/db";
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", dbUrl);
    const { defaultDailyCronDeps } = await import("./default-deps");

    const jobRuns = createFakeJobRunStore();
    const dirtyEtfs = [
      { symbol: "A", outcome: { code: "persist_error" as const, symbol: "A", detail: `write failed: ${SECRET} and ${dbUrl}` } },
      { symbol: "B", outcome: { code: "internal_error" as const, symbol: "B", detail: `connect failed: ${dbUrl}` } },
    ];
    const deps: TestDeps = {
      readEnv: defaultDailyCronDeps.readEnv,
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns,
          runIngestion: async () => ({ etfs: dirtyEtfs }),
          secrets: ctx.secrets,
        }),
    };

    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), deps);
    expect(response.status).toBe(200);
    const responseText = await response.text();
    expect(responseText).not.toContain(SECRET);
    expect(responseText).not.toContain(dbUrl);

    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    const storedLog = (finishCall?.args[1] as { log: string }).log;
    expect(storedLog).not.toContain(SECRET);
    expect(storedLog).not.toContain(dbUrl);
  });

  it("H-15b: an aborted run whose error message contains DATABASE_URL leaks it into neither the stored log nor the 500 body", async () => {
    const dbUrl = "postgresql://user:pw-XYZ@ep-fake.neon.tech/db";
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", dbUrl);
    const { defaultDailyCronDeps } = await import("./default-deps");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const jobRuns = createFakeJobRunStore();
    const deps: TestDeps = {
      readEnv: defaultDailyCronDeps.readEnv,
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns,
          runIngestion: async () => {
            throw new Error(`connect failed: ${dbUrl}`);
          },
          secrets: ctx.secrets,
        }),
    };

    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), deps);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain(dbUrl);

    const finishCall = jobRuns.calls.find((c) => c.method === "finishRun");
    const storedLog = (finishCall?.args[1] as { log: string }).log;
    expect(storedLog).not.toContain(SECRET);
    expect(storedLog).not.toContain(dbUrl);
    spy.mockRestore();
  });
});

describe("AC5/AC7: aborted runs and the job run id/status in the response", () => {
  it("H-15c: an aborted result maps to 500 with jobRunId and status failed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => ({
      kind: "aborted" as const,
      jobRunId: 42,
      status: "failed" as const,
      reason: "run_threw" as const,
    }));
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "run failed", jobRunId: 42, status: "failed" });
    spy.mockRestore();
  });

  it("H-15c: run rejecting (could not start) still gives the unchanged 500 body with no jobRunId, ingest never called", async () => {
    const jobRuns = createFakeJobRunStore({ failOn: "claimScheduledRun" });
    const loadEtfs = vi.fn();
    const ingest = vi.fn();
    const deps: TestDeps = {
      readEnv: () => env(),
      run: (ctx) =>
        runDailyJob({
          now: fixedClock(new Date(), new Date()),
          jobRuns,
          runIngestion: (ctx) => runDailyIngestion({ loadEtfs, ingest }, { startedAt: ctx.startedAt, now: () => ctx.startedAt }),
          secrets: ctx.secrets,
        }),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), deps);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "run could not start" });
    expect(ingest).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("H-15d: a finished result maps to 200 with jobRunId, status and etfs", async () => {
    const run = vi.fn(async () => ({
      kind: "finished" as const,
      jobRunId: 7,
      status: "partial" as const,
      etfs: [{ symbol: "A", outcome: { code: "ok" as const, symbol: "A", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "x", detail: "stored 1 values" } }],
    }));
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      jobRunId: 7,
      status: "partial",
      etfs: [{ symbol: "A", outcome: { code: "ok", symbol: "A", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "x", detail: "stored 1 values" } }],
    });
  });
});
