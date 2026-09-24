import { createDailyRunDeps } from "../ingestion/default-deps";
import { runDailyIngestion } from "../ingestion/run-daily";
import type { DailyCronDeps } from "./daily-handler";

export const defaultDailyCronDeps: DailyCronDeps = {
  readEnv: () => ({ cronSecret: process.env.CRON_SECRET, databaseUrl: process.env.DATABASE_URL }),
  run: async () => runDailyIngestion(createDailyRunDeps()),
};
