import type { Db } from "../db/index";
import { neonBatchRunner } from "../ingestion/store";
import type { AiSettingsDeps } from "../config/ai-settings";
import { PROVIDER_IDS } from "./provider-catalog";

/**
 * `lib/config/` may not import AI code (DEC-016 §1, enforced by `boundaries.test.ts` BC-1), so the
 * allowed provider ids are wired here instead, in `lib/ai`, not in `lib/config/default-deps.ts`.
 */
export function createAiSettingsDeps(db: Db): AiSettingsDeps {
  return { db, run: neonBatchRunner(db), providerIds: PROVIDER_IDS };
}
