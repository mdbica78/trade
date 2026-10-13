import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import { DAILY_CRON_PATH, DEFAULT_CRON_HOUR_UTC, isHour } from "./cron-build";

export { DAILY_CRON_PATH, DEFAULT_CRON_HOUR_UTC, isHour };

export type CronConfigDeps = { db: Db; run: BatchRunner };
export type SetCronHourResult = { ok: true; hour: number } | { ok: false; error: "invalid_hour" };

export function formatHourWindow(hour: number): { start: string; end: string } {
  if (!isHour(hour)) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  const padded = String(hour).padStart(2, "0");
  return { start: `${padded}:00`, end: `${padded}:59` };
}

/** The saved hour, or null when none is saved (or the stored value is not a valid hour). */
export async function getCronHour(deps: CronConfigDeps): Promise<number | null> {
  const [result] = await deps.run([deps.db.execute(sql`select "cron_hour_utc" from "settings" where "id" = 1`)]);
  const rows = rowsOf(result);
  if (rows.length === 0 || rows[0].cron_hour_utc === null) {
    return null;
  }
  const hour = Number(rows[0].cron_hour_utc);
  if (!isHour(hour)) {
    return null;
  }
  return hour;
}

/** The hour the daily job's gate uses (DEC-030): saved hour, else 10 UTC. */
export async function getEffectiveCronHour(deps: CronConfigDeps): Promise<number> {
  return (await getCronHour(deps)) ?? DEFAULT_CRON_HOUR_UTC;
}

/** The Europe/Bucharest wall-clock time of `hour:00` UTC today (DST-aware), as "HH:MM". */
export function bucharestTimeOfUtcHour(hour: number, on: Date = new Date()): string {
  if (!isHour(hour)) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  const instant = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), hour));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

/** The Europe/Bucharest wall-clock window ("HH:MM"-"HH:MM") that a UTC hour's full 60 minutes spans (DST-aware). */
export function bucharestWindowOfUtcHour(hour: number, on: Date = new Date()): { start: string; end: string } {
  if (!isHour(hour)) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }
  const start = bucharestTimeOfUtcHour(hour, on);
  const startInstant = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), hour, 59));
  const end = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(startInstant);
  return { start, end };
}

function normaliseHour(raw: unknown): { ok: true; value: number } | { ok: false } {
  if (typeof raw === "number") {
    return isHour(raw) ? { ok: true, value: raw } : { ok: false };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number(trimmed);
  return isHour(value) ? { ok: true, value } : { ok: false };
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
