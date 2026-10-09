import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

describe("createDb", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws MissingDatabaseUrlError when the URL is undefined, empty or blank", async () => {
    const { createDb, MissingDatabaseUrlError } = await import("./index");
    for (const bad of [undefined, "", "   "]) {
      expect(() => createDb(bad)).toThrow(MissingDatabaseUrlError);
      try {
        createDb(bad);
      } catch (e) {
        expect(e).toBeInstanceOf(MissingDatabaseUrlError);
        expect((e as Error).name).toBe("MissingDatabaseUrlError");
        expect((e as Error).message).toMatch(/DATABASE_URL/);
      }
    }
  });

  it("returns a client for a Neon-shaped URL and calls neon() with it", async () => {
    const { createDb } = await import("./index");
    const { neon } = await import("@neondatabase/serverless");
    const url = "postgresql://user:pass@ep-fake.neon.tech/db?sslmode=require";
    const db = createDb(url);
    expect(db).toBeTruthy();
    expect(neon).toHaveBeenCalledWith(url);
  });
});

describe("getDb", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { neon } = await import("@neondatabase/serverless");
    vi.mocked(neon).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws MissingDatabaseUrlError when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getDb, MissingDatabaseUrlError } = await import("./index");
    expect(() => getDb()).toThrow(MissingDatabaseUrlError);
  });

  it("is a lazy singleton: two calls return the same instance and neon() runs once", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@ep-fake.neon.tech/db");
    const { getDb } = await import("./index");
    const { neon } = await import("@neondatabase/serverless");
    const first = getDb();
    const second = getDb();
    expect(second).toBe(first);
    expect(neon).toHaveBeenCalledTimes(1);
  });
});
