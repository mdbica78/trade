import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import vercelConfig from "../../vercel.json";

export const DAILY_CRON_PATH = "/api/cron/daily";

export type DailySchedule = { minute: number; hour: number };
export type CronConfigDeps = { db: Db; run: BatchRunner };
export type SetCronHourResult = { ok: true; hour: number | null } | { ok: false; error: "invalid_hour" };

/** Parses a "minute hour * * *" cron string; anything else (a range, a step, a weekday, ...) is not a once-a-day schedule, so this returns null rather than guessing an hour. */
export function parseDailySchedule(schedule: unknown): DailySchedule | null {
  if (typeof schedule !== "string") return null;
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields;
  if (dom !== "*" || month !== "*" || dow !== "*") return null;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null;
  const minuteNum = Number(minute);
  const hourNum = Number(hour);
  if (minuteNum < 0 || minuteNum > 59 || hourNum < 0 || hourNum > 23) return null;
  return { minute: minuteNum, hour: hourNum };
}

/** Finds the /api/cron/daily entry's schedule string in a vercel.json-shaped object, without assuming any structure holds. */
export function findDailySchedule(config: unknown): string | null {
  if (config === null || typeof config !== "object") return null;
  const crons = (config as { crons?: unknown }).crons;
  if (!Array.isArray(crons)) return null;
  for (const entry of crons) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      (entry as { path?: unknown }).path === DAILY_CRON_PATH &&
      typeof (entry as { schedule?: unknown }).schedule === "string"
    ) {
      return (entry as { schedule: string }).schedule;
    }
  }
  return null;
}

/** The schedule bundled into this build's vercel.json — never read with `fs` at request time, so it works inside a Vercel function. */
export function effectiveSchedule(): string | null {
  return findDailySchedule(vercelConfig);
}

export function formatHourWindow(hour: number): { start: string; end: string } {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  const padded = String(hour).padStart(2, "0");
  return { start: `${padded}:00`, end: `${padded}:59` };
}

/** The exact vercel.json line to paste in, minute always 0 (choosing the minute is out of scope). */
export function suggestedScheduleLine(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  return `"schedule": "0 ${hour} * * *"`;
}

export function scheduleChangeNeeded(effectiveHour: number | null, desiredHour: number | null): boolean {
  return desiredHour !== null && desiredHour !== effectiveHour;
}

export async function getCronHour(deps: CronConfigDeps): Promise<number | null> {
  const [result] = await deps.run([deps.db.execute(sql`select "cron_hour_utc" from "settings" where "id" = 1`)]);
  const rows = rowsOf(result);
  if (rows.length === 0 || rows[0].cron_hour_utc === null) {
    return null;
  }
  const hour = Number(rows[0].cron_hour_utc);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null;
  }
  return hour;
}

function normaliseHour(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? { ok: true, value: raw } : { ok: false };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number(trimmed);
  return value >= 0 && value <= 23 ? { ok: true, value } : { ok: false };
}

export async function setCronHour(input: unknown, deps: CronConfigDeps): Promise<SetCronHourResult> {
  const hour = normaliseHour(input);
  if (!hour.ok) {
    return { ok: false, error: "invalid_hour" };
  }

  await deps.run([
    deps.db.execute(
      sql`insert into "settings" ("id", "cron_hour_utc") values (1, ${hour.value})
          on conflict ("id") do update set "cron_hour_utc" = excluded."cron_hour_utc"`,
    ),
  ]);

  return { ok: true, hour: hour.value };
}
