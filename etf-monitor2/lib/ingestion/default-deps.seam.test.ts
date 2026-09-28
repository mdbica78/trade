import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { seed } from "../db/seed";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

describe("US-031: the database seam", () => {
  let testDb: EmptyTestDatabase;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "");
    testDb = await createEmptyTestDatabase();
    await seed(testDb.mockDb, testDb.runner);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await testDb.close();
  });

  it("DS-1: with DATABASE_URL unset and an injected database, createDailyRunDeps and createDefaultJobRunStore work over PGlite", async () => {
    const { createDailyRunDeps, createDefaultJobRunStore } = await import("./default-deps");
    const database = { db: testDb.mockDb, run: testDb.runner };

    expect(() => createDailyRunDeps({ now: () => new Date("2026-09-27T08:00:00Z"), database })).not.toThrow();
    expect(() => createDefaultJobRunStore(database)).not.toThrow();

    const deps = createDailyRunDeps({ now: () => new Date("2026-09-27T08:00:00Z"), database });
    const etfs = await deps.loadEtfs();
    expect(etfs.length).toBeGreaterThan(0);
    expect(etfs.map((e) => e.symbol)).toContain("BTBETRETF");
  });

  it("DS-2: without a database, the existing MissingDatabaseUrlError behaviour holds (mirrors DD-15)", async () => {
    const { createDailyRunDeps } = await import("./default-deps");
    const { MissingDatabaseUrlError } = await import("../db/index");
    expect(() => createDailyRunDeps({ now: () => new Date("2026-09-27T08:00:00Z") })).toThrow(MissingDatabaseUrlError);
  });
});
