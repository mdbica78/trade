import { describe, expect, it, vi } from "vitest";
import {
  guardAllMigrations,
  guardMigrationStatements,
  runMigrateOnDeploy,
  sanitizeMigrationOutput,
  type RunChild,
} from "./migrate";
import path from "node:path";

const DRIZZLE_DIR = path.join(__dirname, "..", "..", "drizzle");

describe("runMigrateOnDeploy (US-048 AC1/AC2)", () => {
  it("MD-1: skips with no child on VERCEL_ENV unset", async () => {
    const runChild = vi.fn();
    const result = await runMigrateOnDeploy({}, runChild);
    expect(runChild).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toContain("skipped");
  });

  it("MD-2: skips with no child on VERCEL_ENV=preview", async () => {
    const runChild = vi.fn();
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" }, runChild);
    expect(runChild).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  it("MD-3: skips with no child on VERCEL_ENV=development", async () => {
    const runChild = vi.fn();
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "development", DATABASE_URL: "postgres://x" }, runChild);
    expect(runChild).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  it("MD-4: production with no DATABASE_URL warns, no child, exit 0", async () => {
    const runChild = vi.fn();
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "production" }, runChild);
    expect(runChild).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toContain("WARNING");
  });

  it("MD-5: production with a database runs the child exactly once on success", async () => {
    const runChild: RunChild = vi.fn().mockResolvedValue({ code: 0, output: "" });
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "production", DATABASE_URL: "postgres://x" }, runChild);
    expect(runChild).toHaveBeenCalledTimes(1);
    expect(runChild).toHaveBeenCalledWith("drizzle-kit", ["migrate"]);
    expect(result.exitCode).toBe(0);
  });

  it("MD-6: a failing child retries up to 3 times then exits non-zero", async () => {
    const runChild: RunChild = vi.fn().mockResolvedValue({ code: 1, output: "boom" });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "production", DATABASE_URL: "postgres://x" }, runChild, sleep);
    expect(runChild).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(1);
  });

  it("MD-7: succeeds on the second attempt after one failure", async () => {
    const runChild: RunChild = vi
      .fn()
      .mockResolvedValueOnce({ code: 1, output: "boom" })
      .mockResolvedValueOnce({ code: 0, output: "" });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await runMigrateOnDeploy({ VERCEL_ENV: "production", DATABASE_URL: "postgres://x" }, runChild, sleep);
    expect(runChild).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(0);
  });
});

describe("sanitizeMigrationOutput (US-048 AC3)", () => {
  it("MD-S1: strips a connection string and a driver message, keeps only code and file tokens", () => {
    const raw = "Error connecting to postgres://user:SENTINELPW@host/db: relation error\ncode 42P01 in 0001_etf_report_links.sql";
    const result = sanitizeMigrationOutput(raw);
    expect(result).not.toContain("SENTINELPW");
    expect(result).not.toContain("://");
    expect(result).not.toContain("relation error");
    expect(result).toContain("code=42P01");
    expect(result).toContain("file=0001_etf_report_links.sql");
  });

  it("MD-S2: drops an invalid code and an invalid file name", () => {
    const result = sanitizeMigrationOutput("nothing relevant here, not-a-code, not-a-file.sql");
    expect(result).toBe("");
  });

  it("MD-S3: empty output sanitises to an empty string", () => {
    expect(sanitizeMigrationOutput("")).toBe("");
  });
});

describe("guardMigrationStatements (US-048 AC5, DEC-023 §4)", () => {
  it("MD-G1: a NOT NULL column inside CREATE TABLE is not flagged", () => {
    const sql = `CREATE TABLE "x" (\n\t"id" serial PRIMARY KEY NOT NULL,\n\t"name" text NOT NULL\n);`;
    expect(guardMigrationStatements("test.sql", sql)).toEqual([]);
  });

  it("MD-G2: DROP TABLE is flagged", () => {
    const violations = guardMigrationStatements("test.sql", "DROP TABLE \"x\";");
    expect(violations).toContainEqual({ file: "test.sql", rule: "DROP" });
  });

  it("MD-G3: DROP COLUMN is flagged", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" DROP COLUMN "y";');
    expect(violations).toContainEqual({ file: "test.sql", rule: "DROP" });
  });

  it("MD-G4: RENAME COLUMN is flagged", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" RENAME COLUMN "y" TO "z";');
    expect(violations).toContainEqual({ file: "test.sql", rule: "RENAME" });
  });

  it("MD-G5: ALTER COLUMN ... TYPE is flagged", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" ALTER COLUMN "y" TYPE integer;');
    expect(violations).toContainEqual({ file: "test.sql", rule: "ALTER-COLUMN-TYPE" });
  });

  it("MD-G6: ADD COLUMN ... NOT NULL with no DEFAULT is flagged", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" ADD COLUMN "y" integer NOT NULL;');
    expect(violations).toContainEqual({ file: "test.sql", rule: "NOT-NULL-NO-DEFAULT" });
  });

  it("MD-G7: ADD COLUMN ... NOT NULL DEFAULT 0 is not flagged (expand-only, has a default)", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" ADD COLUMN "y" integer DEFAULT 0 NOT NULL;');
    expect(violations).toEqual([]);
  });

  it("MD-G8: a plain ADD COLUMN with no NOT NULL is not flagged", () => {
    const violations = guardMigrationStatements("test.sql", 'ALTER TABLE "x" ADD COLUMN "y" text;');
    expect(violations).toEqual([]);
  });

  it("MD-G9: the allow-destructive marker exempts the whole file", () => {
    const sql = 'DROP TABLE "x";\n-- allow-destructive: DEC-999';
    expect(guardMigrationStatements("test.sql", sql)).toEqual([]);
  });
});

describe("guardAllMigrations over the real drizzle/ directory (US-048 AC5)", () => {
  it("MD-G10: the current 0000 and 0001 migrations pass the guard", () => {
    expect(guardAllMigrations(DRIZZLE_DIR)).toEqual([]);
  });
});
