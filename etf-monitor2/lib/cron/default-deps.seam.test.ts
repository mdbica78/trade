import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseAccess } from "../ingestion/default-deps";

const createDefaultJobRunStoreMock = vi.fn((_database?: DatabaseAccess) => ({
  failStaleRuns: vi.fn(),
  startRun: vi.fn(),
  claimScheduledRun: vi.fn(async () => 1),
  finishRun: vi.fn(),
}));
const createDailyRunDepsMock = vi.fn((_options: { now: () => Date; database?: DatabaseAccess }) => ({
  loadEtfs: vi.fn(async () => []),
  ingest: vi.fn(),
}));
vi.mock("../ingestion/default-deps", () => ({
  createDefaultJobRunStore: createDefaultJobRunStoreMock,
  createDailyRunDeps: createDailyRunDepsMock,
}));

beforeEach(() => {
  createDefaultJobRunStoreMock.mockClear();
  createDailyRunDepsMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("US-031: createDailyCronDeps database seam", () => {
  it("DS-3: createDailyCronDeps({ database }) passes the same database object to both factories", async () => {
    const { createDailyCronDeps } = await import("./default-deps");
    const database = { db: {}, run: vi.fn() } as unknown as DatabaseAccess;

    const deps = createDailyCronDeps({ database });
    await deps.run({ secrets: [] });

    expect(createDefaultJobRunStoreMock).toHaveBeenCalledWith(database);
    expect(createDailyRunDepsMock).toHaveBeenCalledTimes(1);
    const [depsArg] = createDailyRunDepsMock.mock.calls[0]!;
    expect(depsArg.database).toBe(database);
  });

  it("DS-4: defaultDailyCronDeps passes undefined", async () => {
    const { defaultDailyCronDeps } = await import("./default-deps");
    await defaultDailyCronDeps.run({ secrets: [] });

    expect(createDefaultJobRunStoreMock).toHaveBeenCalledWith(undefined);
  });
});
