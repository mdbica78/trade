import { describe, expect, it, vi } from "vitest";
import {
  CRON_HOUR_QUERY_ATTEMPTS,
  DEFAULT_CRON_HOUR_UTC,
  resolveBuildCronHour,
  type CronHourQuery,
} from "./cron-build";

function fakeQuery(rows: readonly Record<string, unknown>[]): CronHourQuery {
  return vi.fn(async () => rows);
}

function neverCalled(): CronHourQuery {
  return vi.fn(async () => {
    throw new Error("query should never be called");
  });
}

describe("resolveBuildCronHour (CBH)", () => {
  it.each([
    [[{ cron_hour_utc: 7 }], 7],
    [[{ cron_hour_utc: 0 }], 0],
    [[{ cron_hour_utc: 23 }], 23],
    [[{ cron_hour_utc: "7" }], 7],
    [[], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: null }], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: undefined }], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: 24 }], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: -3 }], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: 7.5 }], DEFAULT_CRON_HOUR_UTC],
    [[{ cron_hour_utc: "x" }], DEFAULT_CRON_HOUR_UTC],
  ])("CBH-1: production rows %j resolve to hour %s", async (rows, expected) => {
    const query = fakeQuery(rows);
    const result = await resolveBuildCronHour({
      env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" },
      query,
    });
    expect(result).toEqual({ hour: expected, source: expected === DEFAULT_CRON_HOUR_UTC ? "default" : "db" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("CBH-2: a missing-table error (42P01) gives the default at once, no retry, no throw", async () => {
    const query = vi.fn(async () => {
      throw Object.assign(new Error("relation does not exist"), { name: "NeonDbError", code: "42P01" });
    });
    const sleep = vi.fn(async () => {});
    const result = await resolveBuildCronHour({
      env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" },
      query,
      sleep,
    });
    expect(result).toEqual({ hour: DEFAULT_CRON_HOUR_UTC, source: "default" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("CBH-3: a query that always fails rejects after 3 attempts with 2 sleeps of 1000ms", async () => {
    const query = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { name: "NeonDbError", code: "08006" });
    });
    const sleep = vi.fn(async () => {});
    await expect(
      resolveBuildCronHour({ env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" }, query, sleep }),
    ).rejects.toThrow(/could not read the daily cron hour after 3 attempts \(code=08006\)/);
    expect(query).toHaveBeenCalledTimes(CRON_HOUR_QUERY_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("CBH-4: fails, fails, then succeeds on the 3rd attempt", async () => {
    let calls = 0;
    const query = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error("boom"), { name: "NeonDbError", code: "08006" });
      }
      return [{ cron_hour_utc: 9 }];
    });
    const sleep = vi.fn(async () => {});
    const result = await resolveBuildCronHour({
      env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" },
      query,
      sleep,
    });
    expect(result).toEqual({ hour: 9, source: "db" });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it.each([undefined, "", "preview", "development"])(
    "CBH-5: VERCEL_ENV=%j with a DATABASE_URL gives the default, no query, no fetch",
    async (vercelEnv) => {
      const query = neverCalled();
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const result = await resolveBuildCronHour({
        env: { VERCEL_ENV: vercelEnv, DATABASE_URL: "postgresql://u:p@h/db" },
        query,
      });
      expect(result).toEqual({ hour: DEFAULT_CRON_HOUR_UTC, source: "default" });
      expect(query).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    },
  );

  it.each([undefined, "", "   "])("CBH-6: production with DATABASE_URL=%j gives the default, query never called", async (url) => {
    const query = neverCalled();
    const result = await resolveBuildCronHour({ env: { VERCEL_ENV: "production", DATABASE_URL: url }, query });
    expect(result).toEqual({ hour: DEFAULT_CRON_HOUR_UTC, source: "default" });
    expect(query).not.toHaveBeenCalled();
  });

  it("CBH-7: a thrown error naming the URL never leaks it into the rejection or any log line", async () => {
    const SENTINEL_PW = "SENTINELPW";
    const SENTINEL_HOST = "ep-sentinel-host.neon.tech";
    const url = `postgresql://u:${SENTINEL_PW}@${SENTINEL_HOST}/db`;
    const query = vi.fn(async () => {
      throw Object.assign(new Error(`connect to ${url}`), { name: "NeonDbError", code: "08006" });
    });
    const lines: string[] = [];
    const sleep = vi.fn(async () => {});
    let rejection: unknown;
    try {
      await resolveBuildCronHour({ env: { VERCEL_ENV: "production", DATABASE_URL: url }, query, sleep, log: (l) => lines.push(l) });
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    const message = (rejection as Error).message;
    for (const text of [url, SENTINEL_PW, SENTINEL_HOST]) {
      expect(message).not.toContain(text);
      for (const line of lines) {
        expect(line).not.toContain(text);
      }
    }
    expect(message).toContain("code=08006");
  });

  it("CBH-8: an unsafe error name or a non-SQLSTATE code is not echoed", async () => {
    const lines: string[] = [];
    const query = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { name: "http://evil.example", code: "not-a-sqlstate" });
    });
    await expect(
      resolveBuildCronHour({
        env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" },
        query,
        sleep: vi.fn(async () => {}),
        log: (l) => lines.push(l),
      }),
    ).rejects.toThrow();
    for (const line of lines) {
      expect(line).not.toContain("http://evil.example");
      expect(line).not.toContain("not-a-sqlstate");
      expect(line).toContain("name=Error");
    }
  });

  it("CBH-9: the default query calls neon(url) once and executes the expected select", async () => {
    vi.resetModules();
    const tagFn = vi.fn(async (strings: TemplateStringsArray) => {
      expect(strings.join("")).toContain('select "cron_hour_utc" from "settings" where "id" = 1');
      return [{ cron_hour_utc: 11 }];
    });
    const neonFn = vi.fn(() => tagFn);
    vi.doMock("@neondatabase/serverless", () => ({ neon: neonFn }));
    const { resolveBuildCronHour: freshResolve } = await import("./cron-build");
    const result = await freshResolve({ env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@h/db" } });
    expect(result).toEqual({ hour: 11, source: "db" });
    expect(neonFn).toHaveBeenCalledTimes(1);
    expect(neonFn).toHaveBeenCalledWith("postgresql://u:p@h/db");
    expect(tagFn).toHaveBeenCalledTimes(1);
    vi.doUnmock("@neondatabase/serverless");
    vi.resetModules();
  });

  it("CBH-10: the query receives exactly env.DATABASE_URL; constants hold their documented values", async () => {
    const query = vi.fn(async () => [{ cron_hour_utc: 5 }]);
    await resolveBuildCronHour({ env: { VERCEL_ENV: "production", DATABASE_URL: "postgresql://exact-url/db" }, query });
    expect(query).toHaveBeenCalledWith("postgresql://exact-url/db");
    expect(DEFAULT_CRON_HOUR_UTC).toBe(10);
    expect(CRON_HOUR_QUERY_ATTEMPTS).toBe(3);
  });
});
