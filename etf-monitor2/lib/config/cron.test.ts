import { describe, expect, it, vi } from "vitest";
import {
  bucharestTimeOfUtcHour,
  bucharestWindowOfUtcHour,
  DAILY_CRON_PATH,
  DEFAULT_CRON_HOUR_UTC,
  formatHourWindow,
  getEffectiveCronHour,
  isHour,
  setCronHour,
  type CronConfigDeps,
} from "./cron";
import * as cronBuild from "./cron-build";

describe("formatHourWindow (CP-5)", () => {
  it("formats HH:00 / HH:59 windows", () => {
    expect(formatHourWindow(10)).toEqual({ start: "10:00", end: "10:59" });
    expect(formatHourWindow(0)).toEqual({ start: "00:00", end: "00:59" });
    expect(formatHourWindow(23)).toEqual({ start: "23:00", end: "23:59" });
  });

  it("throws RangeError outside 0-23", () => {
    expect(() => formatHourWindow(24)).toThrow(RangeError);
    expect(() => formatHourWindow(-1)).toThrow(RangeError);
  });
});

describe("cron.ts re-exports the cron-build constants (CE-5), and no removed export remains (CE-6)", () => {
  it("CE-5: DAILY_CRON_PATH/DEFAULT_CRON_HOUR_UTC/isHour are exactly cron-build's", () => {
    expect(DAILY_CRON_PATH).toBe(cronBuild.DAILY_CRON_PATH);
    expect(DEFAULT_CRON_HOUR_UTC).toBe(cronBuild.DEFAULT_CRON_HOUR_UTC);
    expect(isHour).toBe(cronBuild.isHour);
  });

  it("CE-6: effectiveSchedule/findDailySchedule/parseDailySchedule are gone (AC3)", async () => {
    const mod = (await import("./cron")) as Record<string, unknown>;
    expect("effectiveSchedule" in mod).toBe(false);
    expect("findDailySchedule" in mod).toBe(false);
    expect("parseDailySchedule" in mod).toBe(false);
  });
});

function fakeDeps(): { deps: CronConfigDeps; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => [[]]);
  const db = { execute: vi.fn((query: unknown) => query) } as unknown as CronConfigDeps["db"];
  return { deps: { db, run: run as unknown as CronConfigDeps["run"] }, run };
}

describe("setCronHour validation (CV)", () => {
  it("CV-1: accepts valid hours in several shapes", async () => {
    for (const [input, expected] of [
      [0, 0],
      [23, 23],
      ["0", 0],
      ["23", 23],
      ["07", 7],
      [" 7 ", 7],
    ] as const) {
      const { deps } = fakeDeps();
      expect(await setCronHour(input, deps)).toEqual({ ok: true, hour: expected });
    }
  });

  it("CV-2/CV-3: rejects invalid hours — including every way to clear the setting — with zero runner calls", async () => {
    const bad = [
      null,
      undefined,
      "",
      "  ",
      "abc",
      "24",
      "-1",
      "7.5",
      "1e1",
      "+7",
      "0x7",
      "７",
      24,
      -1,
      7.5,
      NaN,
      Infinity,
      true,
      {},
      [],
    ];
    for (const value of bad) {
      const { deps, run } = fakeDeps();
      expect(await setCronHour(value, deps)).toEqual({ ok: false, error: "invalid_hour" });
      expect(run).not.toHaveBeenCalled();
    }
  });
});

describe("effective hour and Bucharest time (US-062 AC2)", () => {
  it("CE-1: the default is 10 UTC", () => {
    expect(DEFAULT_CRON_HOUR_UTC).toBe(10);
  });

  it.each([
    [[], 10],
    [[{ cron_hour_utc: null }], 10],
    [[{ cron_hour_utc: 7 }], 7],
    [[{ cron_hour_utc: 0 }], 0],
    [[{ cron_hour_utc: 23 }], 23],
    [[{ cron_hour_utc: 24 }], 10],
    [[{ cron_hour_utc: -3 }], 10],
    [[{ cron_hour_utc: "x" }], 10],
  ])("CE-2: stored rows %j resolve to hour %s", async (rows, expected) => {
    const { deps, run } = fakeDeps();
    run.mockResolvedValueOnce([{ rows }]);
    expect(await getEffectiveCronHour(deps)).toBe(expected);
  });

  it("CE-3: Bucharest is UTC+3 in summer and UTC+2 in winter; the day is the given one", () => {
    expect(bucharestTimeOfUtcHour(10, new Date("2026-07-15T08:00:00Z"))).toBe("13:00");
    expect(bucharestTimeOfUtcHour(10, new Date("2026-01-15T08:00:00Z"))).toBe("12:00");
    expect(bucharestTimeOfUtcHour(23, new Date("2026-07-15T08:00:00Z"))).toBe("02:00");
    expect(bucharestTimeOfUtcHour(0, new Date("2026-01-15T08:00:00Z"))).toBe("02:00");
    expect(() => bucharestTimeOfUtcHour(24)).toThrow(RangeError);
  });

  it("CE-4: bucharestWindowOfUtcHour gives the full Bucharest span of a UTC hour, DST-aware", () => {
    expect(bucharestWindowOfUtcHour(10, new Date("2026-07-15T08:00:00Z"))).toEqual({ start: "13:00", end: "13:59" });
    expect(bucharestWindowOfUtcHour(10, new Date("2026-01-15T08:00:00Z"))).toEqual({ start: "12:00", end: "12:59" });
    expect(() => bucharestWindowOfUtcHour(24)).toThrow(RangeError);
    expect(() => bucharestWindowOfUtcHour(-1)).toThrow(RangeError);
  });
});
