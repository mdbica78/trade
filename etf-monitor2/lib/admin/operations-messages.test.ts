import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { jobRuns, reports } from "../db/schema";
import { INGEST_OUTCOME_CODES } from "../ingestion/outcome";

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

describe("OM-1: every code/status has a non-empty message key in both catalogues", () => {
  it("every INGEST_OUTCOME_CODES has an Admin.operations.outcome key in ro and en", () => {
    for (const code of INGEST_OUTCOME_CODES) {
      expect(nonEmptyString((ro.Admin.operations.outcome as Record<string, string>)[code]), `ro outcome.${code}`).toBe(true);
      expect(nonEmptyString((en.Admin.operations.outcome as Record<string, string>)[code]), `en outcome.${code}`).toBe(true);
    }
  });

  it("every job_runs.status value has an Admin.operations.runStatus key in ro and en", () => {
    for (const status of jobRuns.status.enumValues) {
      expect(nonEmptyString((ro.Admin.operations.runStatus as Record<string, string>)[status]), `ro runStatus.${status}`).toBe(true);
      expect(nonEmptyString((en.Admin.operations.runStatus as Record<string, string>)[status]), `en runStatus.${status}`).toBe(true);
    }
  });

  it("every reports.status value has an Admin.operations.reportStatus key in ro and en", () => {
    for (const status of reports.status.enumValues) {
      expect(nonEmptyString((ro.Admin.operations.reportStatus as Record<string, string>)[status]), `ro reportStatus.${status}`).toBe(true);
      expect(nonEmptyString((en.Admin.operations.reportStatus as Record<string, string>)[status]), `en reportStatus.${status}`).toBe(true);
    }
  });
});
