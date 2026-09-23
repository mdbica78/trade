import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Set it in .env.local for local development, " +
        "or in the Vercel project's environment variables in production.",
    );
    this.name = "MissingDatabaseUrlError";
  }
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string | undefined = process.env.DATABASE_URL): Db {
  if (!url || url.trim() === "") {
    throw new MissingDatabaseUrlError();
  }
  return drizzle(neon(url), { schema });
}

let cachedDb: Db | undefined;

export function getDb(): Db {
  if (!cachedDb) {
    cachedDb = createDb();
  }
  return cachedDb;
}
