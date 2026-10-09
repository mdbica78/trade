import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHealthStatus, HEALTH_QUERY_TIMEOUT_MS, schemaTableNames } from "./health";
import * as schema from "./db/schema";
import type { Db } from "./db";

function fakeDb(resolve: (table: unknown) => unknown[] | never): Db {
  return {
    select: () => ({
      from: (table: unknown) => Promise.resolve(resolve(table)),
    }),
    execute: () => Promise.resolve([]),
  } as unknown as Db;
}

describe("getHealthStatus", () => {
  it("returns connected counts on the success path", async () => {
    const db = fakeDb(() => [{ count: 3 }]);

    const status = await getHealthStatus(db);

    expect(status).toEqual({ dbConnected: true, etfCount: 3, fieldCatalogCount: 3, schema: { missingTables: [] } });
  });

  it("ST-1: schemaTableNames matches the last migration snapshot's table names", () => {
    const journalPath = path.join(__dirname, "..", "drizzle", "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number }[] };
    const lastIdx = Math.max(...journal.entries.map((e) => e.idx));
    const snapshotPath = path.join(__dirname, "..", "drizzle", "meta", `${String(lastIdx).padStart(4, "0")}_snapshot.json`);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as { tables: Record<string, { name: string }> };
    const expected = Object.values(snapshot.tables)
      .map((t) => t.name)
      .sort();

    expect(schemaTableNames(schema)).toEqual(expected);
  });

  it("returns a failure status with a message when the query rejects, never throwing", async () => {
    const db = {
      select: () => ({
        from: () => Promise.reject(new Error("connection refused")),
      }),
    } as unknown as Db;

    const status = await getHealthStatus(db);

    expect(status).toEqual({ dbConnected: false, error: "connection refused" });
  });

  it("does not leak the query builder itself in the error message", async () => {
    const db = {
      select: () => ({
        from: () => {
          throw "not an Error instance";
        },
      }),
    } as unknown as Db;

    const status = await getHealthStatus(db);

    expect(status).toEqual({ dbConnected: false, error: "not an Error instance" });
  });

  describe("timeout (US-031 AC4)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("HC-1: a query that never settles resolves to a timed-out status after HEALTH_QUERY_TIMEOUT_MS, not before", async () => {
      const db = {
        select: () => ({
          from: () => new Promise(() => undefined),
        }),
      } as unknown as Db;

      const promise = getHealthStatus(db);
      let settled = false;
      promise.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(HEALTH_QUERY_TIMEOUT_MS - 1);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const status = await promise;
      expect(status).toEqual({ dbConnected: false, timedOut: true });
    });

    it("HC-2: on the success path the timer is cleared", async () => {
      const db = fakeDb(() => [{ count: 3 }]);

      await getHealthStatus(db);

      expect(vi.getTimerCount()).toBe(0);
    });

    it("HC-3: a query that rejects after the timeout causes no unhandled rejection", async () => {
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      try {
        let rejectQuery: (error: unknown) => void = () => undefined;
        const db = {
          select: () => ({
            from: () =>
              new Promise((_resolve, reject) => {
                rejectQuery = reject;
              }),
          }),
        } as unknown as Db;

        const promise = getHealthStatus(db);
        await vi.advanceTimersByTimeAsync(HEALTH_QUERY_TIMEOUT_MS);
        const status = await promise;
        expect(status).toEqual({ dbConnected: false, timedOut: true });

        rejectQuery(new Error("late failure"));
        await vi.runAllTimersAsync();
        await Promise.resolve();

        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    });

    it("HC-4: HEALTH_QUERY_TIMEOUT_MS is between 5000 and 10000 ms", () => {
      expect(HEALTH_QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
      expect(HEALTH_QUERY_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
    });

    it("HC-5: counts resolve but the schema probe never settles — still times out at HEALTH_QUERY_TIMEOUT_MS", async () => {
      const db = {
        select: () => ({
          from: () => Promise.resolve([{ count: 1 }]),
        }),
        execute: () => new Promise(() => undefined),
      } as unknown as Db;

      const promise = getHealthStatus(db);
      let settled = false;
      promise.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(HEALTH_QUERY_TIMEOUT_MS - 1);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const status = await promise;
      expect(status).toEqual({ dbConnected: false, timedOut: true });
    });
  });

  it("HC-6: a sentinel-bearing rejection logs one safe line and never leaks it in the status", async () => {
    const SENTINEL = "postgres://user:SENTINELPW@host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      select: () => ({
        from: () => Promise.reject(new Error(`connection refused ${SENTINEL}`)),
      }),
      execute: () => Promise.resolve([]),
    } as unknown as Db;

    const status = await getHealthStatus(db);

    expect(status).toEqual({ dbConnected: false, error: `connection refused ${SENTINEL}` });
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] health /);
    expect(lines[0][0]).not.toContain("SENTINELPW");
    spy.mockRestore();
  });
});
