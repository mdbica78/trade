import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createDrizzleJobRunStore, utcDateOf, type JobRunStore } from "./job-runs";

let db: TestDatabase;
let store: JobRunStore;

beforeEach(async () => {
  db = await createTestDatabase();
  store = createDrizzleJobRunStore(db.mockDb, db.runner);
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function runs() {
  return (
    await db.pg.query<{ id: number; status: string; scheduled_date_utc: string | null; started_at: string }>(
      'select "id", "status", "scheduled_date_utc"::text, "started_at"::text from "job_runs" order by "id"',
    )
  ).rows;
}

async function seedRun(startedAt: string, status: string) {
  await db.pg.query(`insert into "job_runs" ("started_at", "status") values ($1, $2)`, [startedAt, status]);
}

describe("utcDateOf (CL-0)", () => {
  it("is the UTC calendar date of the instant, independent of the process time zone", () => {
    expect(utcDateOf(new Date("2026-10-09T23:59:59.999Z"))).toBe("2026-10-09");
    expect(utcDateOf(new Date("2026-10-10T00:00:00.000Z"))).toBe("2026-10-10");
    expect(utcDateOf(new Date("2026-10-09T00:00:00.000Z"))).toBe("2026-10-09");
  });
});

describe("claimScheduledRun on PGlite (CL, DEC-030)", () => {
  it("CL-1: the first claim of a UTC day inserts one running row marked with that day", async () => {
    const id = await store.claimScheduledRun(new Date("2026-10-09T10:00:05Z"));
    expect(id).toBeTypeOf("number");
    const rows = await runs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, status: "running", scheduled_date_utc: "2026-10-09" });
  });

  it("CL-2: a second claim on the same UTC day returns null and writes nothing", async () => {
    await store.claimScheduledRun(new Date("2026-10-09T10:00:05Z"));
    expect(await store.claimScheduledRun(new Date("2026-10-09T14:00:00Z"))).toBeNull();
    expect(await runs()).toHaveLength(1);
  });

  it.each(["running", "success", "partial", "failed"])(
    "CL-3: an earlier same-day row with status %s and no day marker (any prior run) consumes the day",
    async (status) => {
      await seedRun("2026-10-09T03:00:00Z", status);
      expect(await store.claimScheduledRun(new Date("2026-10-09T10:00:00Z"))).toBeNull();
      expect(await runs()).toHaveLength(1);
    },
  );

  it("CL-4: the day is the UTC day — rows just before UTC midnight or exactly at the next midnight do not block", async () => {
    await seedRun("2026-10-08T23:59:59.999Z", "success");
    const today = await store.claimScheduledRun(new Date("2026-10-09T10:00:00Z"));
    expect(today).toBeTypeOf("number");

    // A run at 00:00:00.000Z of the next day is a new day even though it is one millisecond after.
    const nextDay = await store.claimScheduledRun(new Date("2026-10-10T00:00:00.000Z"));
    expect(nextDay).toBeTypeOf("number");
    expect((await runs()).map((r) => r.scheduled_date_utc)).toEqual([null, "2026-10-09", "2026-10-10"]);
  });

  it("CL-5: a row at 23:59:59.999Z blocks a claim later that same UTC day, not the next day's", async () => {
    await seedRun("2026-10-09T23:59:59.999Z", "failed");
    expect(await store.claimScheduledRun(new Date("2026-10-09T23:59:59.999Z"))).toBeNull();
    expect(await store.claimScheduledRun(new Date("2026-10-10T10:00:00Z"))).toBeTypeOf("number");
  });

  it("CL-6: concurrent claims for one day yield exactly one winner and one row (unique day index)", async () => {
    const at = new Date("2026-10-09T10:00:00Z");
    const results = await Promise.all(Array.from({ length: 6 }, () => store.claimScheduledRun(at)));
    expect(results.filter((id) => id !== null)).toHaveLength(1);
    expect(await runs()).toHaveLength(1);
  });

  it("CL-7: the unique index itself rejects a second marked row for the same day, but allows many unmarked rows", async () => {
    await db.pg.query(`insert into "job_runs" ("started_at", "status", "scheduled_date_utc") values ('2026-10-09T10:00:00Z', 'running', '2026-10-09')`);
    await expect(
      db.pg.query(`insert into "job_runs" ("started_at", "status", "scheduled_date_utc") values ('2026-10-09T11:00:00Z', 'running', '2026-10-09')`),
    ).rejects.toThrow();
    await seedRun("2026-10-01T10:00:00Z", "success");
    await seedRun("2026-10-02T10:00:00Z", "success");
    expect((await runs()).filter((r) => r.scheduled_date_utc === null)).toHaveLength(2);
  });

  it("CL-8: the claimed row is the run row — finishRun updates it, no second row appears", async () => {
    const id = await store.claimScheduledRun(new Date("2026-10-09T10:00:00Z"));
    await store.finishRun(id!, {
      finishedAt: new Date("2026-10-09T10:00:30Z"),
      status: "success",
      etfsProcessed: 2,
      errorsCount: 0,
      log: "success: 2 processed, 0 errors",
    });
    const rows = await runs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, status: "success", scheduled_date_utc: "2026-10-09" });
  });

  it("CL-9: startRun still inserts an unmarked row and is unchanged for non-scheduled callers", async () => {
    await store.startRun(new Date("2026-10-09T10:00:00Z"));
    expect((await runs())[0].scheduled_date_utc).toBeNull();
  });

  it("CL-10: both new indexes exist", async () => {
    const idx = await db.pg.query<{ indexname: string }>(`select "indexname" from pg_indexes where "tablename" = 'job_runs' order by 1`);
    const names = idx.rows.map((r) => r.indexname);
    expect(names).toContain("job_runs_scheduled_date_utc_unique");
    expect(names).toContain("job_runs_started_at_idx");
  });
});
