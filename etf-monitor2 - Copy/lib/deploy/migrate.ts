import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Runs only inside a Vercel production build (DEC-023 §1-§3). Never runs on preview/development
 * or when `DATABASE_URL` is unset, so nothing ever touches Neon from a developer's machine or a
 * preview deployment. Output is sanitised before it is ever printed (AC3): no URL, no driver
 * message, only a bounded allowlist of SQLSTATE codes and migration file names.
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export type DeployEnv = {
  VERCEL_ENV?: string;
  DATABASE_URL?: string;
};

export type RunChild = (command: string, args: readonly string[]) => Promise<{ code: number; output: string }>;
export type Sleep = (ms: number) => Promise<void>;

export type MigrateOnDeployResult = { lines: string[]; exitCode: 0 | 1 };

const SQLSTATE_RE = /\b([0-9A-Z]{5})\b/g;
const MIGRATION_FILE_RE = /\b(\d{4}_[a-z0-9_]+\.sql)\b/g;

/** Keeps only a SQLSTATE code and a migration file name from a child process's raw output — never the message, URL or anything else (AC3). */
export function sanitizeMigrationOutput(raw: string): string {
  const codes = [...raw.matchAll(SQLSTATE_RE)].map((m) => m[1]);
  const files = [...raw.matchAll(MIGRATION_FILE_RE)].map((m) => m[1]);
  const parts: string[] = [];
  if (codes.length > 0) parts.push(`code=${codes[0]}`);
  if (files.length > 0) parts.push(`file=${files[0]}`);
  return parts.join(" ");
}

export async function runMigrateOnDeploy(
  env: DeployEnv,
  runChild: RunChild,
  sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<MigrateOnDeployResult> {
  if (env.VERCEL_ENV !== "production") {
    return { lines: ["migrate-on-deploy: skipped (not a production build)"], exitCode: 0 };
  }
  if (!env.DATABASE_URL) {
    return { lines: ["migrate-on-deploy: WARNING — production build with no DATABASE_URL, skipping migrations"], exitCode: 0 };
  }

  let lastOutput = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runChild("drizzle-kit", ["migrate"]);
    lastOutput = result.output;
    if (result.code === 0) {
      return { lines: ["migrate-on-deploy: migrations applied"], exitCode: 0 };
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  const detail = sanitizeMigrationOutput(lastOutput);
  return {
    lines: [`migrate-on-deploy: FAILED after ${MAX_ATTEMPTS} attempts${detail ? ` (${detail})` : ""}`],
    exitCode: 1,
  };
}

export type MigrationGuardViolation = { file: string; rule: "DROP" | "RENAME" | "ALTER-COLUMN-TYPE" | "NOT-NULL-NO-DEFAULT" };

const DROP_RE = /\bDROP\s+(TABLE|COLUMN)\b/i;
const RENAME_RE = /\bRENAME\s+(TO|COLUMN)\b/i;
const ALTER_TYPE_RE = /\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i;
const ADD_COLUMN_RE = /\bADD\s+COLUMN\b/i;
const NOT_NULL_RE = /\bNOT\s+NULL\b/i;
const DEFAULT_RE = /\bDEFAULT\b/i;
const ALLOW_DESTRUCTIVE_RE = /--\s*allow-destructive:\s*DEC-\d+/i;
const CREATE_TABLE_RE = /^\s*CREATE\s+TABLE\b/i;

/** Expand-only guard (DEC-023 §4, AC5): a statement inside a `CREATE TABLE` is always safe (a brand-new table's own `NOT NULL` is not a migration hazard). Only later `ALTER TABLE` statements are checked. */
export function guardMigrationStatements(fileName: string, sql: string): MigrationGuardViolation[] {
  if (ALLOW_DESTRUCTIVE_RE.test(sql)) {
    return [];
  }
  const violations: MigrationGuardViolation[] = [];
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    if (CREATE_TABLE_RE.test(statement)) {
      continue;
    }
    if (DROP_RE.test(statement)) {
      violations.push({ file: fileName, rule: "DROP" });
    }
    if (RENAME_RE.test(statement)) {
      violations.push({ file: fileName, rule: "RENAME" });
    }
    if (ALTER_TYPE_RE.test(statement)) {
      violations.push({ file: fileName, rule: "ALTER-COLUMN-TYPE" });
    }
    if (ADD_COLUMN_RE.test(statement) && NOT_NULL_RE.test(statement) && !DEFAULT_RE.test(statement)) {
      violations.push({ file: fileName, rule: "NOT-NULL-NO-DEFAULT" });
    }
  }
  return violations;
}

export function guardAllMigrations(drizzleDir: string): MigrationGuardViolation[] {
  const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
  return files.flatMap((file) => guardMigrationStatements(file, readFileSync(path.join(drizzleDir, file), "utf8")));
}

export async function spawnDrizzleMigrate(command: string, args: readonly string[]): Promise<{ code: number; output: string }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("pnpm", command === "drizzle-kit" ? ["exec", "drizzle-kit", ...args] : [command, ...args], {
      env: process.env,
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
    child.on("error", () => resolve({ code: 1, output: "" }));
  });
}
