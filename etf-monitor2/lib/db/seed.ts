import { sql } from "drizzle-orm";
import type { Db } from "./index";
import type { BatchRunner } from "../ingestion/store";
import { neonBatchRunner } from "../ingestion/store";
import {
  seedEtfs,
  seedFieldCatalog,
  seedSettings,
  seedTrackedFields,
} from "./seed-data";

/**
 * Every statement is insert-if-absent, except `field_catalog` (still an upsert — it describes
 * what the adapters, which are code, extract). A seeded ETF's tracked fields are inserted only
 * when **this run** inserted that ETF (the `with ins as (... returning id)` CTE), so a field the
 * admin removed never comes back (Sprint 1 audit W1/W2, US-020 AC1). Safe to re-run any number
 * of times; never overwrites an admin's changes.
 */
export function buildSeedStatements(db: Db) {
  const fieldCatalogValues = sql.join(
    seedFieldCatalog.map(
      (field) =>
        sql`(${field.adapterKey}, ${field.fieldKey}, ${field.labelRo}, ${field.labelEn}, ${field.unit})`,
    ),
    sql`, `,
  );

  const seedFieldCatalogStatement = db.execute(
    sql`insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en", "unit")
        values ${fieldCatalogValues}
        on conflict ("adapter_key", "field_key") do update set
          "label_ro" = excluded."label_ro",
          "label_en" = excluded."label_en",
          "unit" = excluded."unit"`,
  );

  const trackedFieldsValues = sql.join(
    seedTrackedFields.map((field) => sql`(${field.fieldKey}::text, ${field.displayOrder}::int)`),
    sql`, `,
  );

  const seedEtfStatements = seedEtfs.map((etf) =>
    db.execute(
      sql`with "ins" as (
            insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key")
            values (${etf.symbol}, ${etf.name}, ${etf.bvbUrl}, ${etf.adapterKey})
            on conflict ("symbol") do nothing
            returning "id")
          insert into "tracked_fields" ("etf_id", "field_key", "display_order")
          select "ins"."id", "v"."field_key", "v"."display_order"
          from "ins" cross join (values ${trackedFieldsValues}) as "v"("field_key", "display_order")
          on conflict ("etf_id", "field_key") do nothing`,
    ),
  );

  const seedSettingsStatement = db.execute(
    sql`insert into "settings" ("id", "default_locale")
        values (${seedSettings.id}, ${seedSettings.defaultLocale})
        on conflict ("id") do nothing`,
  );

  return [seedFieldCatalogStatement, ...seedEtfStatements, seedSettingsStatement] as const;
}

/** Runs `buildSeedStatements` in one batch: atomic on Neon (`db.batch`), a transaction on PGlite. */
export async function seed(db: Db, run: BatchRunner = neonBatchRunner(db)): Promise<void> {
  await run(buildSeedStatements(db));
}
