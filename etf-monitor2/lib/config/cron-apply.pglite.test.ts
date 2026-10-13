import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { saveCronHourAndApply, type RedeployResult } from "./cron-apply";
import type { CronConfigDeps } from "./cron";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 30_000);

afterEach(async () => {
  await db.close();
});

function deps(): CronConfigDeps {
  return { db: db.mockDb, run: db.runner };
}

async function savedHour(): Promise<number | null> {
  const row = await db.pg.query<{ cron_hour_utc: number | null }>('select "cron_hour_utc" from "settings" where "id" = 1');
  return row.rows[0]?.cron_hour_utc ?? null;
}

describe("saveCronHourAndApply on PGlite (SA)", () => {
  it("SA-1: no existing row — saving an hour redeploys once and reports the hook's result", async () => {
    const redeploy = vi.fn(async (): Promise<RedeployResult> => "applying");
    const result = await saveCronHourAndApply("7", { config: deps(), redeploy });
    expect(result).toEqual({ ok: true, hour: 7, apply: "applying" });
    expect(redeploy).toHaveBeenCalledTimes(1);
    expect(await savedHour()).toBe(7);
  });

  it("SA-2: saving the same hour again is unchanged, and never redeploys", async () => {
    await saveCronHourAndApply("7", { config: deps(), redeploy: async () => "applying" });
    const redeploy = vi.fn(async (): Promise<RedeployResult> => "applying");
    const result = await saveCronHourAndApply("7", { config: deps(), redeploy });
    expect(result).toEqual({ ok: true, hour: 7, apply: "unchanged" });
    expect(redeploy).not.toHaveBeenCalled();
  });

  it("SA-3: a hook failure never undoes the save", async () => {
    await saveCronHourAndApply("7", { config: deps(), redeploy: async () => "applying" });
    const result = await saveCronHourAndApply("9", { config: deps(), redeploy: async () => "failed" });
    expect(result).toEqual({ ok: true, hour: 9, apply: "failed" });
    expect(await savedHour()).toBe(9);
  });

  it("SA-4: a redeploy that throws still leaves the row saved and reports apply:failed", async () => {
    await saveCronHourAndApply("7", { config: deps(), redeploy: async () => "applying" });
    const result = await saveCronHourAndApply("9", {
      config: deps(),
      redeploy: async () => {
        throw new Error("hook network error");
      },
    });
    expect(result).toEqual({ ok: true, hour: 9, apply: "failed" });
    expect(await savedHour()).toBe(9);
  });

  it("SA-5: an invalid hour never redeploys and leaves the row unchanged", async () => {
    await saveCronHourAndApply("7", { config: deps(), redeploy: async () => "applying" });
    const redeploy = vi.fn(async (): Promise<RedeployResult> => "applying");
    const result = await saveCronHourAndApply("24", { config: deps(), redeploy });
    expect(result).toEqual({ ok: false, error: "invalid_hour" });
    expect(redeploy).not.toHaveBeenCalled();
    expect(await savedHour()).toBe(7);
  });

  it("SA-6: inside the redeploy callback, the new hour is already visible in the database", async () => {
    let seenDuringRedeploy: number | null = null;
    await saveCronHourAndApply("7", {
      config: deps(),
      redeploy: async () => {
        seenDuringRedeploy = await savedHour();
        return "applying";
      },
    });
    expect(seenDuringRedeploy).toBe(7);
  });

  it("SA-7: a stored NULL moving to a valid hour still counts as a change and redeploys once", async () => {
    await db.pg.query('insert into "settings" ("id", "cron_hour_utc") values (1, null)');
    const redeploy = vi.fn(async (): Promise<RedeployResult> => "applying");
    const result = await saveCronHourAndApply("10", { config: deps(), redeploy });
    expect(result).toEqual({ ok: true, hour: 10, apply: "applying" });
    expect(redeploy).toHaveBeenCalledTimes(1);
  });
});
