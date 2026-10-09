import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { effectiveSchedule, getCronHour, setCronHour, type CronConfigDeps } from "./cron";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 30_000);

afterEach(async () => {
  await db.close();
  vi.unstubAllEnvs();
});

function deps(overrides: Partial<CronConfigDeps> = {}): CronConfigDeps {
  return { db: db.mockDb, run: db.runner, ...overrides };
}

describe("setCronHour / getCronHour on PGlite (CS)", () => {
  it("CS-1: saves the hour, leaves the other settings columns untouched", async () => {
    await db.pg.query(
      'insert into "settings" ("id", "ai_provider", "ai_model", "cron_hour_utc", "default_locale") values (1, $1, $2, null, $3)',
      ["groq", "m", "en"],
    );
    const result = await setCronHour("7", deps());
    expect(result).toEqual({ ok: true, hour: 7 });
    const row = await db.pg.query<{
      ai_provider: string | null;
      ai_model: string | null;
      cron_hour_utc: number | null;
      default_locale: string;
    }>('select "ai_provider", "ai_model", "cron_hour_utc", "default_locale" from "settings" where "id" = 1');
    expect(row.rows).toEqual([{ ai_provider: "groq", ai_model: "m", cron_hour_utc: 7, default_locale: "en" }]);
    expect((await db.pg.query('select * from "settings"')).rows).toHaveLength(1);
  });

  it("CS-2: with no existing row, save creates id=1 with the column defaults", async () => {
    await setCronHour("7", deps());
    const row = await db.pg.query<{
      ai_provider: string | null;
      ai_model: string | null;
      default_locale: string;
    }>('select "ai_provider", "ai_model", "default_locale" from "settings" where "id" = 1');
    expect(row.rows).toEqual([{ ai_provider: null, ai_model: null, default_locale: "ro" }]);
  });

  it("CS-3: clearing the hour nulls only cron_hour_utc", async () => {
    await db.pg.query(
      'insert into "settings" ("id", "ai_provider", "ai_model", "cron_hour_utc", "default_locale") values (1, $1, $2, 7, $3)',
      ["groq", "m", "en"],
    );
    const result = await setCronHour("", deps());
    expect(result).toEqual({ ok: true, hour: null });
    const row = await db.pg.query<{
      ai_provider: string | null;
      ai_model: string | null;
      cron_hour_utc: number | null;
      default_locale: string;
    }>('select "ai_provider", "ai_model", "cron_hour_utc", "default_locale" from "settings" where "id" = 1');
    expect(row.rows).toEqual([{ ai_provider: "groq", ai_model: "m", cron_hour_utc: null, default_locale: "en" }]);
  });

  it("CS-3b: hour 0 is stored as 0, not NULL (falsy trap)", async () => {
    const result = await setCronHour("0", deps());
    expect(result).toEqual({ ok: true, hour: 0 });
    const row = await db.pg.query<{ cron_hour_utc: number | null }>('select "cron_hour_utc" from "settings" where "id" = 1');
    expect(row.rows[0].cron_hour_utc).toBe(0);
  });

  it("CS-4: an invalid save leaves the row (or the empty table) unchanged", async () => {
    const beforeEmpty = await db.pg.query('select * from "settings"');
    await expect(setCronHour("abc", deps())).resolves.toEqual({ ok: false, error: "invalid_hour" });
    expect((await db.pg.query('select * from "settings"')).rows).toEqual(beforeEmpty.rows);

    await db.pg.query('insert into "settings" ("id", "cron_hour_utc") values (1, 7)');
    const before = await db.pg.query('select * from "settings"');
    await expect(setCronHour("24", deps())).resolves.toEqual({ ok: false, error: "invalid_hour" });
    expect((await db.pg.query('select * from "settings"')).rows).toEqual(before.rows);
  });

  it("CS-5: getCronHour reflects saves, including 0", async () => {
    expect(await getCronHour(deps())).toBeNull();
    await setCronHour("7", deps());
    expect(await getCronHour(deps())).toBe(7);
    await setCronHour("0", deps());
    expect(await getCronHour(deps())).toBe(0);
  });

  it("CS-6: an out-of-range stored value (no CHECK) reads as null", async () => {
    await db.pg.query('insert into "settings" ("id", "cron_hour_utc") values (1, 30)');
    expect(await getCronHour(deps())).toBeNull();
  });

  it("CS-7: a successful save is exactly one runner call holding one statement", async () => {
    const spy = vi.fn(db.runner);
    const result = await setCronHour("7", deps({ run: spy as unknown as CronConfigDeps["run"] }));
    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveLength(1);
  });

  it("CS-8: no network call, effectiveSchedule() unaffected by a save", async () => {
    const before = effectiveSchedule();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await setCronHour("7", deps());
    await getCronHour(deps());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(effectiveSchedule()).toBe(before);
  });
});
