import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

describe("createDefaultIngestDeps", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("wires the Sprint 2 functions, the default registry and a working store, without any I/O", async () => {
    const { createDefaultIngestDeps } = await import("./default-deps");
    const { discoverLatestReport } = await import("../extraction/discovery");
    const { downloadReportPdf, extractPdfText } = await import("../extraction/pdf");
    const { defaultAdapterRegistry } = await import("../extraction/adapters/default-registry");

    const deps = createDefaultIngestDeps();

    expect(deps.discover).toBe(discoverLatestReport);
    expect(deps.download).toBe(downloadReportPdf);
    expect(deps.extractText).toBe(extractPdfText);
    expect(deps.registry).toBe(defaultAdapterRegistry);
    expect(typeof deps.store.findReport).toBe("function");
    expect(typeof deps.store.saveReport).toBe("function");
  });
});

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
    expect(() => createDailyRunDeps()).toThrow(MissingDatabaseUrlError);
  });

  it("returns loadEtfs and ingest functions, with no network or DB call made yet", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
    const { createDailyRunDeps } = await import("./default-deps");
    const deps = createDailyRunDeps();
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
