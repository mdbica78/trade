import { createDailyRunDeps, createDefaultJobRunStore, type DatabaseAccess } from "../ingestion/default-deps";
import { runDailyIngestion } from "../ingestion/run-daily";
import { runDailyJob } from "./daily-job";
import type { DailyCronDeps } from "./daily-handler";

const now = () => new Date();

/**
 * `options.database`, when present, is passed to both factories unchanged (US-031 plan section
 * 2.1) — only a test supplies it (a PGlite database + runner). With no argument,
 * `defaultDailyCronDeps` below passes `undefined` to both, which is the unchanged production
 * path: each factory calls `getDb()` itself.
 */
export function createDailyCronDeps(options: { database?: DatabaseAccess } = {}): DailyCronDeps {
  return {
    readEnv: () => ({ cronSecret: process.env.CRON_SECRET, databaseUrl: process.env.DATABASE_URL }),
    run: async ({ secrets }) =>
      runDailyJob({
        now,
        jobRuns: createDefaultJobRunStore(options.database),
        runIngestion: ({ startedAt }) =>
          runDailyIngestion(createDailyRunDeps({ now, database: options.database }), { startedAt, now }),
        secrets,
      }),
  };
}

export const defaultDailyCronDeps: DailyCronDeps = createDailyCronDeps();
