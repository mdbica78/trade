import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DATA_MODEL_PATH = path.join(__dirname, "..", "dev_minions", "architecture", "data-model.md");

describe("data-model.md documents the multi-report filing write rules (US-037 AC9)", () => {
  const doc = readFileSync(DATA_MODEL_PATH, "utf8");

  it("DM-1: names the per-filing batches, the URL skip, and the every-field storage rule", () => {
    expect(doc).toContain("MAX_REPORTS_PER_FILING");
    expect(doc).toContain("no batch mixes two reports");
    expect(doc).toContain("findStoredReportUrls");
    expect(doc).toContain("skipped with no request");
    expect(doc).toContain("Every field the adapter extracts is stored");
    expect(doc).toContain("not what is stored");
  });

  it("DM-HD-1 (US-047 AC8/AC9): documents shared display tables, atomic writes, optional reads and deploy migrations", () => {
    expect(doc).toContain("`home_display_settings`, `home_display_columns`, `home_display_etfs`");
    expect(doc).toContain("`lib/config/home-display.ts` is the only writer");
    expect(doc).toContain("replaces the rows of all three tables in one atomic batch");
    expect(doc).toContain("`lib/monitoring/home.ts` alone reads the home-display tables");
    expect(doc).toContain("If any one is missing (`42P01`)");
    expect(doc).toContain("the production build applies them during deploy");
    expect(doc).not.toContain("applied to Neon only by the user");
  });

  it("DM-AI-1 (US-040 AC1/AC8): documents ciphertext-only provider-key storage and its source-bound read rule", () => {
    expect(doc).toContain("`ai_provider_keys` — encrypted provider credentials");
    expect(doc).toContain("base64 of `iv ‖ authentication tag ‖ ciphertext`");
    expect(doc).toContain("`master` or `cron_derived`");
    expect(doc).toContain("`lib/ai/key-store.ts` alone encrypts/decrypts and reads/writes `ai_provider_keys`");
    expect(doc).toMatch(/Plaintext\s+is never persisted, returned to `\/app`, rendered, or logged/);
  });
});
