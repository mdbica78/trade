import { neon } from "@neondatabase/serverless";

/** The daily cron route's path (DEC-031). `vercel.ts` and `lib/config/cron.ts` both re-export this. */
export const DAILY_CRON_PATH = "/api/cron/daily";

/** Used when no hour is saved yet, or the saved value is not a valid hour. */
export const DEFAULT_CRON_HOUR_UTC = 10;

/** DEC-031 §2: a production build whose query keeps failing retries this many times in total before throwing. */
export const CRON_HOUR_QUERY_ATTEMPTS = 3;

/** Delay between retry attempts (ms); injected `sleep` in tests never actually waits. */
export const CRON_HOUR_RETRY_DELAY_MS = 1_000;

export function isHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

export type BuildEnv = { VERCEL_ENV?: string; DATABASE_URL?: string };
export type CronHourQuery = (databaseUrl: string) => Promise<readonly Record<string, unknown>[]>;
export type BuildCronHour = { hour: number; source: "db" | "default" };

/** The only place that talks to Neon from the build step: a plain tagged-template query, no Drizzle. */
export function neonCronHourQuery(databaseUrl: string): Promise<readonly Record<string, unknown>[]> {
  const sql = neon(databaseUrl);
  return sql`select "cron_hour_utc" from "settings" where "id" = 1` as unknown as Promise<
    readonly Record<string, unknown>[]
  >;
}

function parseHourFromRows(rows: readonly Record<string, unknown>[]): number | null {
  if (rows.length === 0) {
    return null;
  }
  const raw = rows[0]?.cron_hour_utc;
  if (raw === null || raw === undefined) {
    return null;
  }
  const hour = Number(raw);
  return isHour(hour) ? hour : null;
}

/** Keeps a driver error's name out of a log line unless it looks like a real JS Error name (never a URL fragment). */
function sanitiseErrorName(name: unknown): string {
  return typeof name === "string" && /^[A-Za-z]\w{0,40}$/.test(name) ? name : "Error";
}

/** Keeps a driver error's code out of a log line unless it is shaped like a Postgres SQLSTATE. */
function sanitiseSqlState(code: unknown): string | null {
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves the hour Vercel's build should bake into the daily cron schedule (DEC-031 §2).
 * Never touches a driver error's `message`/`cause`/`stack`: only a sanitised name and SQLSTATE
 * ever reach a log line or the thrown error, so a connection string can never leak through either.
 */
export async function resolveBuildCronHour(input: {
  env: BuildEnv;
  query?: CronHourQuery;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}): Promise<BuildCronHour> {
  const { env } = input;
  const query = input.query ?? neonCronHourQuery;
  const sleep = input.sleep ?? defaultSleep;
  const log = input.log ?? (() => {});

  const databaseUrl = env.DATABASE_URL;
  if (env.VERCEL_ENV !== "production" || !databaseUrl || databaseUrl.trim() === "") {
    return { hour: DEFAULT_CRON_HOUR_UTC, source: "default" };
  }

  let lastCode: string | null = null;
  for (let attempt = 1; attempt <= CRON_HOUR_QUERY_ATTEMPTS; attempt += 1) {
    try {
      const rows = await query(databaseUrl);
      const hour = parseHourFromRows(rows);
      return hour === null ? { hour: DEFAULT_CRON_HOUR_UTC, source: "default" } : { hour, source: "db" };
    } catch (error) {
      const code = (error as { code?: unknown } | undefined)?.code;
      if (code === "42P01") {
        return { hour: DEFAULT_CRON_HOUR_UTC, source: "default" };
      }
      const name = sanitiseErrorName((error as { name?: unknown } | undefined)?.name);
      lastCode = sanitiseSqlState(code);
      log(
        `[vercel.ts] cron hour query failed (attempt ${attempt}/${CRON_HOUR_QUERY_ATTEMPTS}) name=${name}` +
          (lastCode ? ` code=${lastCode}` : ""),
      );
      if (attempt < CRON_HOUR_QUERY_ATTEMPTS) {
        await sleep(CRON_HOUR_RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(
    `[vercel.ts] could not read the daily cron hour after ${CRON_HOUR_QUERY_ATTEMPTS} attempts` +
      (lastCode ? ` (code=${lastCode})` : ""),
  );
}
