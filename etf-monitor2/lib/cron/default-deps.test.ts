import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyJobDeps } from "./daily-job";

const runDailyJobMock = vi.fn(async (_deps: DailyJobDeps) => ({
  kind: "finished" as const,
  jobRunId: 1,
  status: "success" as const,
  etfs: [],
}));
vi.mock("./daily-job", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./daily-job")>();
  return { ...actual, runDailyJob: runDailyJobMock };
});

const createDefaultJobRunStoreMock = vi.fn(() => ({
  failStaleRuns: vi.fn(),
  startRun: vi.fn(),
  finishRun: vi.fn(),
}));
const createDailyRunDepsMock = vi.fn(() => ({ loadEtfs: vi.fn(), ingest: vi.fn() }));
vi.mock("../ingestion/default-deps", () => ({
  createDefaultJobRunStore: createDefaultJobRunStoreMock,
  createDailyRunDeps: createDailyRunDepsMock,
}));

beforeEach(() => {
  runDailyJobMock.mockClear();
  createDefaultJobRunStoreMock.mockClear();
  createDailyRunDepsMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("defaultDailyCronDeps", () => {
  it("readEnv reads CRON_SECRET and DATABASE_URL from process.env", async () => {
    vi.stubEnv("CRON_SECRET", "the-secret");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db");
    const { defaultDailyCronDeps } = await import("./default-deps");
    expect(defaultDailyCronDeps.readEnv()).toEqual({
      cronSecret: "the-secret",
      databaseUrl: "postgresql://u:p@ep-fake.neon.tech/db",
    });
  });

  it("run passes the handler's secrets array through to runDailyJob, with a lazily-built job-run store and clock", async () => {
    const { defaultDailyCronDeps } = await import("./default-deps");
    const secrets = ["cron-secret-value", "postgresql://u:p@ep-fake.neon.tech/db"];

    await defaultDailyCronDeps.run({ secrets });

    expect(runDailyJobMock).toHaveBeenCalledTimes(1);
    const [arg] = runDailyJobMock.mock.calls[0]!;
    expect(arg.secrets).toBe(secrets);
    expect(typeof arg.now).toBe("function");
    expect(createDefaultJobRunStoreMock).toHaveBeenCalledTimes(1);
    expect(createDailyRunDepsMock).not.toHaveBeenCalled(); // runIngestion is a thunk, not called by defaultDailyCronDeps.run itself
  });
});
