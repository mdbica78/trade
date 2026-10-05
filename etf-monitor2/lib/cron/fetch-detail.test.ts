import { describe, expect, it } from "vitest";
import { createFakeJobRunStore } from "../../test/helpers/job-run-fakes";
import { FakeLinkStore, FAKE_FILING_FIELD_KEY } from "../../test/helpers/ingest-fakes";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf } from "../extraction/pdf";
import type { AdapterRegistry, ExtractionAdapter } from "../extraction/adapters/types";
import { handleDailyCron } from "./daily-handler";
import { runDailyJob } from "./daily-job";
import { runDailyIngestion } from "../ingestion/run-daily";
import { ingestEtf, type IngestEtfInput, type IngestDeps } from "../ingestion/ingest-etf";
import type { ReportStore, SaveReportResult } from "../ingestion/store";

const SENTINEL = "SENTINEL_FETCH";
const PAGE_URL = "https://bvb.ro/x";
const PDF_URL = "https://bvb.ro/x/report.pdf";

class FakeStore implements ReportStore {
  async findStoredReportUrls(): Promise<ReadonlyMap<string, string>> {
    return new Map();
  }
  async saveReport(): Promise<SaveReportResult> {
    return { status: "written", reportId: 1 };
  }
}

const adapter: ExtractionAdapter = {
  key: "fake",
  fieldKeys: [FAKE_FILING_FIELD_KEY],
  canHandle: () => true,
  extract: () => ({ ok: true, reportDate: "2026-09-20", values: [], missingFields: [] }),
};
const registry: Pick<AdapterRegistry, "get"> = { get: () => adapter };

const ETF: IngestEtfInput = {
  id: 1,
  symbol: "FD-TEST",
  bvbUrl: PAGE_URL,
  adapterKey: "fake",
  trackedFieldKeys: [FAKE_FILING_FIELD_KEY],
};

async function runOneEtf(fetchImpl: typeof fetch): Promise<{ log: string; responseBody: string }> {
  const deps: IngestDeps = {
    discover: (etf) => discoverLatestReport(etf, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl, timeoutMs: 20 }),
    extractText: async () => ({ ok: true, text: "x" }),
    registry,
    store: new FakeStore(),
    links: new FakeLinkStore(),
    now: () => new Date("2026-09-20T08:00:00Z"),
  };

  const jobRuns = createFakeJobRunStore();
  const secrets: readonly string[] = [];
  const result = await handleDailyCron(
    new Request("https://x/api/cron/daily", { headers: { authorization: "Bearer s" } }),
    {
      readEnv: () => ({ cronSecret: "s", databaseUrl: undefined }),
      run: () =>
        runDailyJob({
          now: () => new Date("2026-09-20T08:00:00Z"),
          jobRuns,
          secrets,
          runIngestion: ({ startedAt }) =>
            runDailyIngestion(
              {
                loadEtfs: async () => [{ ...ETF, isActive: true }],
                ingest: (etf, run) => ingestEtf(etf, { ...deps, canStartDownload: run.canStartDownload }),
              },
              { startedAt, now: () => startedAt },
            ),
        }),
    },
  );

  const responseBody = await result.text();
  const row = [...jobRuns.rows.values()][0];
  return { log: row?.log ?? "", responseBody };
}

function assertNoLeak(text: string) {
  expect(text).not.toContain("://");
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain("fetch failed");
  expect(text).not.toContain("is not a PDF");
  expect(text).not.toContain("timed out after");
}

describe("US-049 AC5 (A13): no URL or raw fetch message leaks on a failing fetch", () => {
  it("FD-1: discovery network failure", async () => {
    const fetchImpl = (async () => {
      throw new TypeError(`fetch failed ${SENTINEL}`);
    }) as unknown as typeof fetch;

    const { log, responseBody } = await runOneEtf(fetchImpl);

    assertNoLeak(log);
    assertNoLeak(responseBody);
    expect(log).toContain("discovery network");
  });

  it("FD-2: discovery http error", async () => {
    const fetchImpl = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;

    const { log, responseBody } = await runOneEtf(fetchImpl);

    assertNoLeak(log);
    assertNoLeak(responseBody);
    expect(log).toContain("discovery http_error 503");
  });

  it("FD-3: download network failure", async () => {
    const html = `<table id="gv5News"><tr><td><input value="VAN la data 20.09.2026"><p class="date">20.09.2026 9:00:00</p><a href="${PDF_URL}">x</a></td></tr></table>`;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u === PAGE_URL) {
        return new Response(html, { status: 200 });
      }
      throw new TypeError(`fetch failed ${SENTINEL}`);
    }) as unknown as typeof fetch;

    const { log, responseBody } = await runOneEtf(fetchImpl);

    assertNoLeak(log);
    assertNoLeak(responseBody);
    expect(log).toContain("download network");
  });

  it("FD-4: download not_pdf", async () => {
    const html = `<table id="gv5News"><tr><td><input value="VAN la data 20.09.2026"><p class="date">20.09.2026 9:00:00</p><a href="${PDF_URL}">x</a></td></tr></table>`;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u === PAGE_URL) {
        return new Response(html, { status: 200 });
      }
      return new Response("not a pdf", { status: 200 });
    }) as unknown as typeof fetch;

    const { log, responseBody } = await runOneEtf(fetchImpl);

    assertNoLeak(log);
    assertNoLeak(responseBody);
    expect(log).toContain("download not_pdf");
  });

  it("FD-5: download timeout", async () => {
    const html = `<table id="gv5News"><tr><td><input value="VAN la data 20.09.2026"><p class="date">20.09.2026 9:00:00</p><a href="${PDF_URL}">x</a></td></tr></table>`;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u === PAGE_URL) {
        return new Response(html, { status: 200 });
      }
      return new Promise(() => undefined) as unknown as Promise<Response>;
    }) as unknown as typeof fetch;

    const { log, responseBody } = await runOneEtf(fetchImpl);

    assertNoLeak(log);
    assertNoLeak(responseBody);
    expect(log).toContain("download timeout");
  }, 10_000);
});
