import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health";
import type { Db } from "./db";

function fakeDb(resolve: (table: unknown) => unknown[] | never): Db {
  return {
    select: () => ({
      from: (table: unknown) => Promise.resolve(resolve(table)),
    }),
  } as unknown as Db;
}

describe("getHealthStatus", () => {
  it("returns connected counts on the success path", async () => {
    const db = fakeDb(() => [{ count: 3 }]);

    const status = await getHealthStatus(db);

    expect(status).toEqual({ dbConnected: true, etfCount: 3, fieldCatalogCount: 3 });
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
});
