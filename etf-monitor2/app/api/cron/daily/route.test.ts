import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/cron/daily", { headers });
}

describe("AC7: route exports", () => {
  it("RT-7a: exports only GET, runtime, dynamic, maxDuration with the expected values", async () => {
    const route = await import("./route");
    expect(Object.keys(route).sort()).toEqual(["GET", "dynamic", "maxDuration", "runtime"]);
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(typeof route.maxDuration).toBe("number");
    expect(route.maxDuration).toBe(60);
  });

  it("RT-7b: the duration budget fits inside maxDuration for the current active ETF count", async () => {
    const { CRON_FETCH_TIMEOUT_MS } = await import("../../../../lib/ingestion/run-daily");
    const route = await import("./route");
    const seedEtfCount = 3;
    const NON_FETCH_ALLOWANCE_MS = 15_000;
    const budget = seedEtfCount * 2 * CRON_FETCH_TIMEOUT_MS + NON_FETCH_ALLOWANCE_MS;
    expect(budget).toBeLessThanOrEqual(route.maxDuration * 1000);
  });
});

describe("AC1/AC6: real route auth and response shape, no DB access before auth", () => {
  it("RT-1a: CRON_SECRET empty and Bearer header gives 500 cron not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer " }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "cron not configured" });
  });

  it("RT-1b: CRON_SECRET set, no header gives 401", async () => {
    vi.stubEnv("CRON_SECRET", "rt-secret-123456");
    const { GET } = await import("./route");
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it("RT-1c: env is read at request time, not at module load", async () => {
    vi.stubEnv("CRON_SECRET", "a-secret-1111");
    const { GET } = await import("./route");

    const firstWithSecondSecret = await GET(request({ authorization: "Bearer b-secret-2222" }));
    expect(firstWithSecondSecret.status).toBe(401);

    vi.stubEnv("CRON_SECRET", "b-secret-2222");
    const secondWithSecondSecret = await GET(request({ authorization: "Bearer b-secret-2222" }));
    expect(secondWithSecondSecret.status).not.toBe(401);
  });

  it("RT-6: correct bearer with no DATABASE_URL gives 500 run could not start (MissingDatabaseUrlError caught)", async () => {
    vi.stubEnv("CRON_SECRET", "rt-secret-123456");
    const { GET } = await import("./route");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request({ authorization: "Bearer rt-secret-123456" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "run could not start" });
    spy.mockRestore();
  });
});
