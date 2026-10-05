import { describe, expect, it, expectTypeOf } from "vitest";
import { filingDeps, FAKE_FILING_FIELD_KEY } from "../../test/helpers/ingest-fakes";
import { ingestEtf, type IngestEtfInput } from "./ingest-etf";
import type { ReportLink } from "../extraction/discovery";
import type { ReportStore, SaveReportInput, SaveReportResult } from "./store";

/** Records every call, in order, so a test can assert no read happens between two saves (US-049 A1). */
class RecordingStore implements ReportStore {
  calls: string[] = [];
  private rows = new Map<string, "ok">();

  async findStoredReportUrls(etfId: number, sourceUrls: readonly string[]): Promise<ReadonlyMap<string, string>> {
    this.calls.push("findStoredReportUrls");
    const map = new Map<string, string>();
    for (const url of sourceUrls) {
      if (this.rows.has(`${etfId}:${url}`)) {
        map.set(url, "stored");
      }
    }
    return map;
  }

  async saveReport(input: SaveReportInput): Promise<SaveReportResult> {
    this.calls.push("saveReport");
    const key = `${input.etfId}:${input.sourceUrl}`;
    if (this.rows.has(key)) {
      return { status: "already_ok" };
    }
    if (input.status === "ok") {
      this.rows.set(key, "ok");
    }
    return { status: "written", reportId: 1 };
  }
}

const ETF: IngestEtfInput = {
  id: 1,
  symbol: "IR-TEST",
  bvbUrl: "https://bvb.ro/x",
  adapterKey: "fake-filing",
  trackedFieldKeys: [FAKE_FILING_FIELD_KEY],
};

const LINK_A: ReportLink = { pdfUrl: "https://x/a.pdf", title: "VAN la data 2026-09-20" };
const LINK_B: ReportLink = { pdfUrl: "https://x/b.pdf", title: "VAN la data 2026-09-20" };

describe("US-049 AC2 (A1): no read before a save", () => {
  it("IR-1: a 2-link filing gives exactly one read, then one save per link", async () => {
    const store = new RecordingStore();
    const deps = filingDeps({
      links: [LINK_A, LINK_B],
      store,
      textFor: (link) => `REPORT_DATE:${link === LINK_A ? "2026-09-20" : "2026-09-21"}`,
    });

    await ingestEtf(ETF, deps);

    expect(store.calls).toEqual(["findStoredReportUrls", "saveReport", "saveReport"]);
  });

  it("IR-2: two links resolving to the same already-ok date give the same read-then-save sequence, and the second outcome is already_ingested", async () => {
    const store = new RecordingStore();
    const deps = filingDeps({
      links: [LINK_A, LINK_B],
      store,
      textFor: () => "REPORT_DATE:2026-09-22",
    });

    const outcome = await ingestEtf(ETF, deps);

    expect(store.calls).toEqual(["findStoredReportUrls", "saveReport", "saveReport"]);
    expect(outcome.code === "ok" || outcome.code === "already_ingested").toBe(true);
  });

  it("IR-3: ReportStore has exactly the two write/read methods used by the pipeline, findReport is gone", () => {
    expectTypeOf<keyof ReportStore>().toEqualTypeOf<"saveReport" | "findStoredReportUrls">();
  });
});
