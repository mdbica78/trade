import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissingDatabaseUrlError } from "../db/index";
import { runDailyIngestion } from "../ingestion/run-daily";
import { handleDailyCron, type CronEnv, type DailyCronDeps } from "./daily-handler";

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
    const run = vi.fn(async () => ({ etfs: [] }));
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET} ` }), { readEnv: () => env(), run });
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("H-1f: composed with runDailyIngestion, neither loadEtfs nor ingest is called on bad auth", async () => {
    const loadEtfs = vi.fn();
    const ingest = vi.fn();
    const deps: DailyCronDeps = { readEnv: () => env(), run: () => runDailyIngestion({ loadEtfs, ingest }) };
    const response = await handleDailyCron(request({ authorization: "Bearer wrong" }), deps);
    expect(response.status).toBe(401);
    expect(loadEtfs).not.toHaveBeenCalled();
    expect(ingest).not.toHaveBeenCalled();
  });

  it("H-1g: the correct bearer runs the job and returns 200", async () => {
    const run = vi.fn(async () => ({ etfs: [] }));
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
  it("H-3c / H-6a: a completed run with mixed outcomes gives 200 with every entry", async () => {
    const summary = {
      etfs: [
        { symbol: "A", outcome: { code: "ok" as const, symbol: "A", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "x" } },
        { symbol: "B", outcome: { code: "internal_error" as const, symbol: "B", detail: "boom" } },
        { symbol: "C", outcome: { code: "failed" as const, symbol: "C", stage: "download" as const, message: "no" } },
      ],
    };
    const run = vi.fn(async () => summary);
    const response = await handleDailyCron(request({ authorization: `Bearer ${SECRET}` }), { readEnv: () => env(), run });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
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
      etfs: [
        {
          symbol: "A",
          outcome: {
            code: "failed" as const,
            symbol: "A",
            stage: "download" as const,
            message: `leaked ${testEnv.cronSecret} and ${testEnv.databaseUrl}`,
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
});
