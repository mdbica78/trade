import { getDb } from "../lib/db";
import { neonBatchRunner } from "../lib/ingestion/store";
import { seed } from "../lib/db/seed";

const db = getDb();
seed(db, neonBatchRunner(db))
  .then(() => {
    console.log("Seed complete.");
  })
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  });
