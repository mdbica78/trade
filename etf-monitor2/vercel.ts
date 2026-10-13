import { isHour, resolveBuildCronHour, DAILY_CRON_PATH, type BuildCronHour } from "./lib/config/cron-build";

type CronJob = { path: string; schedule: string };
export type VercelConfig = { crons: CronJob[] };

/** AC1 (US-064): the schedule entry for a given hour, minute fixed at 0. */
export function buildDailyCron(hour: number): CronJob {
  if (!isHour(hour)) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  return { path: DAILY_CRON_PATH, schedule: `0 ${hour} * * *` };
}

/**
 * Builds the config Vercel bakes into this deployment at build time (DEC-031 §1/§2). The default
 * resolver reads `process.env` only here, never inside `lib/config/cron-build.ts` itself, so the
 * resolver stays unit-testable with an injected environment.
 */
export async function createVercelConfig(
  resolve: () => Promise<BuildCronHour> = () =>
    resolveBuildCronHour({
      env: { VERCEL_ENV: process.env.VERCEL_ENV, DATABASE_URL: process.env.DATABASE_URL },
    }),
  log: (line: string) => void = console.log,
): Promise<VercelConfig> {
  const { hour, source } = await resolve();
  log(`[vercel.ts] daily cron hour ${hour} UTC (source: ${source})`);
  return { crons: [buildDailyCron(hour)] };
}

export const config: VercelConfig = await createVercelConfig();
