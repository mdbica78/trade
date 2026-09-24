import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ __fakeNeonSql: true })),
}));

const discoverLatestReport = vi.fn(async () => ({ status: "not_found" as const, reason: "list_not_found" as const }));

vi.mock("../extraction/discovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extraction/discovery")>();
  return { ...actual, discoverLatestReport };
});

describe("createDailyRunDeps wires the shorter cron fetch timeout into discovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
    discoverLatestReport.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls discoverLatestReport with { timeoutMs: 7000 } (CRON_FETCH_TIMEOUT_MS)", async () => {
    const { createDailyRunDeps } = await import("./default-deps");
    const { CRON_FETCH_TIMEOUT_MS } = await import("./run-daily");
    const deps = createDailyRunDeps();

    const outcome = await deps.ingest({
      id: 1,
      symbol: "AAA",
      bvbUrl: "https://bvb.ro/AAA",
      adapterKey: "brd-depositary",
      trackedFieldKeys: [],
    });

    expect(discoverLatestReport).toHaveBeenCalledTimes(1);
    expect(discoverLatestReport).toHaveBeenCalledWith(
      { symbol: "AAA", bvbUrl: "https://bvb.ro/AAA" },
      { timeoutMs: CRON_FETCH_TIMEOUT_MS },
    );
    expect(outcome).toMatchObject({ code: "failed", stage: "discovery" });
  });
});
