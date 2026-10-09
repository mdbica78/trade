import path from "node:path";
import { guardAllMigrations, runMigrateOnDeploy, spawnDrizzleMigrate } from "../lib/deploy/migrate";

async function main() {
  const violations = guardAllMigrations(path.join(__dirname, "..", "drizzle"));
  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`migrate-on-deploy: BLOCKED — ${v.file}: ${v.rule}`);
    }
    process.exitCode = 1;
    return;
  }

  const result = await runMigrateOnDeploy({ VERCEL_ENV: process.env.VERCEL_ENV, DATABASE_URL: process.env.DATABASE_URL }, spawnDrizzleMigrate);
  for (const line of result.lines) {
    console.log(line);
  }
  process.exitCode = result.exitCode;
}

void main();
