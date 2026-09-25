import { createDailyRunDeps, createDefaultJobRunStore } from "../ingestion/default-deps";
import { runDailyIngestion } from "../ingestion/run-daily";
import { runDailyJob } from "./daily-job";
import type { DailyCronDeps } from "./daily-handler";

export const defaultDailyCronDeps: DailyCronDeps = {
  readEnv: () => ({ cronSecret: process.env.CRON_SECRET, databaseUrl: process.env.DATABASE_URL }),
  run: async ({ secrets }) =>
    runDailyJob({
      now: () => new Date(),
      jobRuns: createDefaultJobRunStore(),
      runIngestion: () => runDailyIngestion(createDailyRunDeps()),
      secrets,
    }),
};
