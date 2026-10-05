import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

describe("createDailyRunDeps", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws MissingDatabaseUrlError when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { createDailyRunDeps } = await import("./default-deps");
    const { MissingDatabaseUrlError } = await import("../db/index");
    expect(() => createDailyRunDeps({ now: () => new Date("2026-09-27T08:00:00Z") })).toThrow(MissingDatabaseUrlError);
  });

  it("returns loadEtfs and ingest functions, with no network or DB call made yet", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
    const { createDailyRunDeps } = await import("./default-deps");
    const deps = createDailyRunDeps({ now: () => new Date("2026-09-27T08:00:00Z") });
    expect(typeof deps.loadEtfs).toBe("function");
    expect(typeof deps.ingest).toBe("function");
  });
});

describe("DD-15: createDefaultJobRunStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws MissingDatabaseUrlError when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { createDefaultJobRunStore } = await import("./default-deps");
    const { MissingDatabaseUrlError } = await import("../db/index");
    expect(() => createDefaultJobRunStore()).toThrow(MissingDatabaseUrlError);
  });

  it("returns a store with all three methods, with no call made yet", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
    const { createDefaultJobRunStore } = await import("./default-deps");
    const store = createDefaultJobRunStore();
    expect(typeof store.failStaleRuns).toBe("function");
    expect(typeof store.startRun).toBe("function");
    expect(typeof store.finishRun).toBe("function");
  });
});
