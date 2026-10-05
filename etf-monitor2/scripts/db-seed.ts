import { getDb } from "../lib/db";
import { seed } from "../lib/db/seed";

seed(getDb())
  .then(() => {
    console.log("Seed complete.");
  })
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  });
