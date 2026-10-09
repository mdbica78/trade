import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  effectiveSchedule,
  findDailySchedule,
  formatHourWindow,
  parseDailySchedule,
  scheduleChangeNeeded,
  setCronHour,
  suggestedScheduleLine,
  type CronConfigDeps,
} from "./cron";

describe("parseDailySchedule (CP)", () => {
  it("CP-1: parses whitespace-tolerant once-a-day schedules", () => {
    expect(parseDailySchedule("0 10 * * *")).toEqual({ minute: 0, hour: 10 });
    expect(parseDailySchedule("0 0 * * *")).toEqual({ minute: 0, hour: 0 });
    expect(parseDailySchedule("59 23 * * *")).toEqual({ minute: 59, hour: 23 });
    expect(parseDailySchedule(" 5  7 * * * ")).toEqual({ minute: 5, hour: 7 });
  });

  it("CP-2: rejects anything that is not a plain once-a-day schedule", () => {
    const bad = [
      "*/5 * * * *",
      "0 */2 * * *",
      "0 10 * * 1",
      "0 10 1 * *",
      "0 10 * 1 *",
      "0 10,22 * * *",
      "0 10-12 * * *",
      "0 24 * * *",
      "60 10 * * *",
      "-1 10 * * *",
      "0 1.5 * * *",
      "0 10 * *",
      "0 10 * * * *",
      "",
      "@daily",
      null,
      undefined,
      10,
    ];
    for (const value of bad) {
      expect(parseDailySchedule(value)).toBeNull();
    }
  });
});

describe("findDailySchedule (CP-3)", () => {
  it("picks the /api/cron/daily entry among several", () => {
    const config = { crons: [{ path: "/api/other", schedule: "0 1 * * *" }, { path: "/api/cron/daily", schedule: "0 10 * * *" }] };
    expect(findDailySchedule(config)).toBe("0 10 * * *");
  });

  it("returns null for missing/malformed crons or config", () => {
    expect(findDailySchedule({})).toBeNull();
    expect(findDailySchedule({ crons: "nope" })).toBeNull();
    expect(findDailySchedule({ crons: [{ path: "/api/other", schedule: "0 1 * * *" }] })).toBeNull();
    expect(findDailySchedule({ crons: [{ path: "/api/cron/daily", schedule: 123 }] })).toBeNull();
    expect(findDailySchedule(null)).toBeNull();
    expect(findDailySchedule("nope")).toBeNull();
  });
});

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

describe("suggestedScheduleLine (CP-4)", () => {
  it("is the exact vercel.json line, minute always 0", () => {
    expect(suggestedScheduleLine(7)).toBe('"schedule": "0 7 * * *"');
    expect(suggestedScheduleLine(0)).toBe('"schedule": "0 0 * * *"');
  });

  it("parses back to the same hour for every hour 0-23", () => {
    for (let h = 0; h <= 23; h++) {
      const line = suggestedScheduleLine(h);
      const parsed = JSON.parse(`{${line}}`) as { schedule: string };
      expect(parseDailySchedule(parsed.schedule)).toEqual({ minute: 0, hour: h });
    }
  });

  it("throws RangeError for a programming error, never reached from validated input", () => {
    expect(() => suggestedScheduleLine(24)).toThrow(RangeError);
    expect(() => suggestedScheduleLine(-1)).toThrow(RangeError);
    expect(() => suggestedScheduleLine(1.5)).toThrow(RangeError);
  });
});

describe("scheduleChangeNeeded (CP-6)", () => {
  it.each([
    [10, null, false],
    [10, 10, false],
    [10, 7, true],
    [10, 0, true],
    [null, 7, true],
    [null, null, false],
  ])("(%s, %s) -> %s", (effectiveHour, desiredHour, expected) => {
    expect(scheduleChangeNeeded(effectiveHour, desiredHour)).toBe(expected);
  });
});

describe("effectiveSchedule (VJ-1)", () => {
  it("matches the repository's own vercel.json", () => {
    const repoRoot = path.join(__dirname, "..", "..");
    const config = JSON.parse(readFileSync(path.join(repoRoot, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const entry = config.crons.find((c) => c.path === "/api/cron/daily");
    expect(entry).toBeDefined();
    expect(effectiveSchedule()).toBe(entry!.schedule);
    const [minute, hour] = entry!.schedule.split(" ");
    expect(parseDailySchedule(effectiveSchedule())).toEqual({ minute: Number(minute), hour: Number(hour) });
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
      [null, null],
      [undefined, null],
      ["", null],
      ["  ", null],
    ] as const) {
      const { deps } = fakeDeps();
      expect(await setCronHour(input, deps)).toEqual({ ok: true, hour: expected });
    }
  });

  it("CV-2/CV-3: rejects invalid hours, zero runner calls", async () => {
    const bad = [
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
