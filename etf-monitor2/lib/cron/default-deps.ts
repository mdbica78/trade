import { createDailyRunDeps, createDefaultJobRunStore } from "../ingestion/default-deps";
import { runDailyIngestion } from "../ingestion/run-daily";
import { runDailyJob } from "./daily-job";
import type { DailyCronDeps } from "./daily-handler";

const now = () => new Date();

export const defaultDailyCronDeps: DailyCronDeps = {
  readEnv: () => ({ cronSecret: process.env.CRON_SECRET, databaseUrl: process.env.DATABASE_URL }),
  run: async ({ secrets }) =>
    runDailyJob({
      now,
      jobRuns: createDefaultJobRunStore(),
      runIngestion: ({ startedAt }) => runDailyIngestion(createDailyRunDeps({ now }), { startedAt, now }),
      secrets,
    }),
};
