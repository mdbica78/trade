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
});
