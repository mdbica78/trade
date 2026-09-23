import { sql } from "drizzle-orm";
import type { Db } from "./index";
import { etfs, fieldCatalog, settings, trackedFields } from "./schema";
import {
  seedEtfs,
  seedFieldCatalog,
  seedSettings,
  seedTrackedFields,
} from "./seed-data";

/** Idempotent: safe to run any number of times, inserts or no-ops on conflict. */
export async function seed(db: Db): Promise<void> {
  for (const etf of seedEtfs) {
    await db
      .insert(etfs)
      .values(etf)
      .onConflictDoUpdate({
        target: etfs.symbol,
        set: { name: etf.name, bvbUrl: etf.bvbUrl, adapterKey: etf.adapterKey },
      });
  }

  for (const field of seedFieldCatalog) {
    await db
      .insert(fieldCatalog)
      .values(field)
      .onConflictDoUpdate({
        target: [fieldCatalog.adapterKey, fieldCatalog.fieldKey],
        set: { labelRo: field.labelRo, labelEn: field.labelEn, unit: field.unit },
      });
  }

  for (const etf of seedEtfs) {
    const [row] = await db
      .select({ id: etfs.id })
      .from(etfs)
      .where(sql`${etfs.symbol} = ${etf.symbol}`);
    if (!row) continue;

    for (const tracked of seedTrackedFields) {
      await db
        .insert(trackedFields)
        .values({ etfId: row.id, fieldKey: tracked.fieldKey, displayOrder: tracked.displayOrder })
        .onConflictDoUpdate({
          target: [trackedFields.etfId, trackedFields.fieldKey],
          set: { displayOrder: tracked.displayOrder },
        });
    }
  }

  await db
    .insert(settings)
    .values(seedSettings)
    .onConflictDoUpdate({
      target: settings.id,
      set: { defaultLocale: seedSettings.defaultLocale },
    });
}
