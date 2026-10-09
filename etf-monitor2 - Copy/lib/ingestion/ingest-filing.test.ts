import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportLink } from "../extraction/discovery";
import { FakeStore, FIXED_NOW, filingDeps, linkDeps, FAKE_FILING_FIELD_KEY } from "../../test/helpers/ingest-fakes";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";

const etf: IngestEtfInput = {
  id: 1,
  symbol: "AAA",
  bvbUrl: "https://bvb.ro/AAA",
  adapterKey: "fake-filing",
  trackedFieldKeys: [],
};

function link(pdfUrl: string, decoyDate: string): ReportLink {
  return { pdfUrl, title: `decoy title ${decoyDate}`, publishedAt: `${decoyDate}T00:00` };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AC1: every report of the filing is downloaded and persisted (US-037)", () => {
  it("MF-1: 3 links, each with its own report date, newest first, one saveReport call per report", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));

    const links = [
      link("https://x/decoy-2099-c.pdf", "2099-01-01"),
      link("https://x/decoy-2099-b.pdf", "2099-02-01"),
      link("https://x/decoy-2099-a.pdf", "2099-03-01"),
    ];
    const dateFor = new Map([
      [links[0].pdfUrl, "2026-09-20"],
      [links[1].pdfUrl, "2026-09-19"],
      [links[2].pdfUrl, "2026-09-18"],
    ]);
    const store = new FakeStore();
    const deps = filingDeps({ links, store, textFor: (l) => `REPORT_DATE:${dateFor.get(l.pdfUrl)}` });

    const outcome = await ingestEtf(etf, deps);

    expect(store.saveReportCalls).toHaveLength(3);
    expect(store.saveReportCalls.map((c) => c.reportDate)).toEqual(["2026-09-20", "2026-09-19", "2026-09-18"]);
    expect(store.saveReportCalls.map((c) => c.sourceUrl)).toEqual(links.map((l) => l.pdfUrl));
    for (const call of store.saveReportCalls) {
      expect(call.values).toEqual([{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "1", rawValue: "1" }]);
    }
    expect(outcome).toMatchObject({ code: "ok", reportDate: "2026-09-20", valuesWritten: 3 });
  });
});

describe("AC3: idempotent by URL, completes on re-run", () => {
  it("MF-3: a mid-filing download failure still saves the other links; a re-run downloads only the failed one", async () => {
    const links = [link("https://x/ok-a.pdf", "d1"), link("https://x/fail-b.pdf", "d2"), link("https://x/ok-c.pdf", "d3")];
    const dateFor = new Map([
      [links[0].pdfUrl, "2026-09-20"],
      [links[1].pdfUrl, "2026-09-19"],
      [links[2].pdfUrl, "2026-09-18"],
    ]);
    const store = new FakeStore();
    const downloadCalls: string[] = [];
    let failDownloadOnce = true;
    const textByUrl = new Map(links.map((l) => [l.pdfUrl, `REPORT_DATE:${dateFor.get(l.pdfUrl)}`] as const));
    const deps: IngestDeps = {
      discover: async () => ({ status: "found", ...links[0], links, truncated: false }),
      download: async (url: string) => {
        downloadCalls.push(url);
        if (url === links[1].pdfUrl && failDownloadOnce) {
          return { ok: false, kind: "http_error", httpStatus: 500, message: "server error" };
        }
        return { ok: true, bytes: new TextEncoder().encode(url), fetchedAt: FIXED_NOW };
      },
      extractText: async (bytes: Uint8Array) => {
        const url = new TextDecoder().decode(bytes);
        return { ok: true, text: textByUrl.get(url)! };
      },
      registry: { get: () => ({ key: "fake-filing", fieldKeys: [FAKE_FILING_FIELD_KEY], canHandle: () => true, extract: (text: string) => ({ ok: true as const, reportDate: /REPORT_DATE:(\S+)/.exec(text)![1], values: [{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "1", rawValue: "1" }], missingFields: [] }) }) },
      store,
      ...linkDeps(),
    };

    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({
      code: "fetch_error",
      detail: "stored 2, already stored 0, failed 1, not attempted 0; download http_error 500: server error",
    });
    expect(store.saveReportCalls).toHaveLength(2);
    expect(store.saveReportCalls.map((c) => c.reportDate).sort()).toEqual(["2026-09-18", "2026-09-20"]);

    failDownloadOnce = false;
    downloadCalls.length = 0;
    const second = await ingestEtf(etf, deps);
    expect(downloadCalls).toEqual([links[1].pdfUrl]);
    expect(second).toMatchObject({ code: "ok", detail: "stored 1, already stored 2, failed 0, not attempted 0; 1 values written" });
  });
});

describe("AC3: findStoredReportUrls is called exactly once, with every kept URL", () => {
  it("MF-4: one call per ingestEtf, and findReport is never called for a URL-skipped link", async () => {
    const links = [link("https://x/a.pdf", "d1"), link("https://x/b.pdf", "d2")];
    const dateFor = new Map([
      [links[0].pdfUrl, "2026-09-20"],
      [links[1].pdfUrl, "2026-09-19"],
    ]);
    const store = new FakeStore();
    store.seed(etf.id, "2026-09-20", "ok", [], null, links[0].pdfUrl);
    const deps = filingDeps({ links, store, textFor: (l) => `REPORT_DATE:${dateFor.get(l.pdfUrl)}` });

    await ingestEtf(etf, deps);

    expect(store.findStoredReportUrlsCalls).toHaveLength(1);
    expect(store.findStoredReportUrlsCalls[0].sourceUrls).toEqual(links.map((l) => l.pdfUrl));
    expect(store.findReportCalls).toHaveLength(1);
    expect(store.findReportCalls[0].reportDate).toBe("2026-09-19");
  });
});

describe("AC4: never downgraded, duplicate date within one filing is harmless (D-2)", () => {
  it("MFP-5: an existing ok report keeps its original URL/values when a same-filing link resolves to the same date under a different URL", async () => {
    const store = new FakeStore();
    store.seed(
      etf.id,
      "2026-09-22",
      "ok",
      [{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "99", rawValue: "99" }],
      null,
      "https://x/original.pdf",
    );
    const links = [link("https://x/old.pdf", "d1"), link("https://x/new.pdf", "d2")];
    const dateFor = new Map([
      [links[0].pdfUrl, "2026-09-21"],
      [links[1].pdfUrl, "2026-09-22"],
    ]);
    const deps = filingDeps({ links, store, textFor: (l) => `REPORT_DATE:${dateFor.get(l.pdfUrl)}` });

    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "ok", detail: "stored 1, already stored 1, failed 0, not attempted 0; 1 values written" });

    const existing = store.rows.get(store.key(etf.id, "2026-09-22"))!;
    expect(existing.sourceUrl).toBe("https://x/original.pdf");
    expect(existing.status).toBe("ok");
    expect([...existing.values.values()]).toEqual([{ numericValue: "99", rawValue: "99" }]);
  });

  it("MFP-6: a same-filing link that would be incomplete for an already-ok date leaves the ok row untouched", async () => {
    const store = new FakeStore();
    store.seed(
      etf.id,
      "2026-09-22",
      "ok",
      [{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "99", rawValue: "99" }],
      null,
      "https://x/original.pdf",
    );
    const links = [link("https://x/new.pdf", "d1")];
    const trackedEtf: IngestEtfInput = { ...etf, trackedFieldKeys: ["not_a_real_field"] };
    const deps = filingDeps({ links, store, textFor: () => "REPORT_DATE:2026-09-22" });

    const outcome = await ingestEtf(trackedEtf, deps);
    expect(outcome).toMatchObject({ code: "already_ingested", detail: "stored 0, already stored 1, failed 0, not attempted 0" });
    const existing = store.rows.get(store.key(etf.id, "2026-09-22"))!;
    expect(existing.status).toBe("ok");
    expect([...existing.values.values()]).toEqual([{ numericValue: "99", rawValue: "99" }]);
  });

  it("MFP-7: two links in one filing resolving to the same new date give one report, stored once", async () => {
    const store = new FakeStore();
    const links = [link("https://x/a.pdf", "d1"), link("https://x/b.pdf", "d2")];
    const deps = filingDeps({ links, store, textFor: () => "REPORT_DATE:2026-09-22" });

    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "ok", detail: "stored 1, already stored 1, failed 0, not attempted 0; 1 values written" });
    expect(store.saveReportCalls).toHaveLength(1);
  });
});

describe("AC2: a tracked key the adapter did not return persists every found value anyway", () => {
  it("MF-6: an unknown tracked key gives parse_error/incomplete but every found value is saved", async () => {
    const links = [link("https://x/a.pdf", "d1")];
    const store = new FakeStore();
    const trackedEtf: IngestEtfInput = { ...etf, trackedFieldKeys: ["not_a_real_field"] };
    const deps = filingDeps({ links, store, textFor: () => "REPORT_DATE:2026-09-20" });

    const outcome = await ingestEtf(trackedEtf, deps);
    expect(outcome).toMatchObject({ code: "parse_error", reason: "incomplete" });
    expect(store.saveReportCalls[0].values).toEqual([{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "1", rawValue: "1" }]);
  });
});

describe("AC5: the deadline guard is per download, never for the first PDF", () => {
  it("MF-7: link 2's download crosses the deadline; links 3 and 4 are not_attempted, no download call", async () => {
    const links = [
      link("https://x/1.pdf", "d1"),
      link("https://x/2.pdf", "d2"),
      link("https://x/3.pdf", "d3"),
      link("https://x/4.pdf", "d4"),
    ];
    const store = new FakeStore();
    store.seed(etf.id, "2026-09-18", "ok", [], null, links[0].pdfUrl);
    const dateFor = new Map([
      [links[1].pdfUrl, "2026-09-19"],
      [links[2].pdfUrl, "2026-09-20"],
      [links[3].pdfUrl, "2026-09-21"],
    ]);
    let deadlinePassed = false;
    const downloadCalls: string[] = [];
    const textByUrl = new Map(links.map((l) => [l.pdfUrl, `REPORT_DATE:${dateFor.get(l.pdfUrl) ?? "2026-09-18"}`] as const));
    const deps: IngestDeps = {
      discover: async () => ({ status: "found", ...links[0], links, truncated: false }),
      download: async (url: string) => {
        downloadCalls.push(url);
        if (url === links[1].pdfUrl) {
          deadlinePassed = true;
        }
        return { ok: true, bytes: new TextEncoder().encode(url), fetchedAt: FIXED_NOW };
      },
      extractText: async (bytes: Uint8Array) => ({ ok: true, text: textByUrl.get(new TextDecoder().decode(bytes))! }),
      registry: {
        get: () => ({
          key: "fake-filing",
          fieldKeys: [FAKE_FILING_FIELD_KEY],
          canHandle: () => true,
          extract: (text: string) => ({
            ok: true as const,
            reportDate: /REPORT_DATE:(\S+)/.exec(text)![1],
            values: [{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "1", rawValue: "1" }],
            missingFields: [],
          }),
        }),
      },
      store,
      canStartDownload: () => !deadlinePassed,
      ...linkDeps(),
    };

    const outcome = await ingestEtf(etf, deps);
    expect(downloadCalls).toEqual([links[1].pdfUrl]);
    expect(outcome).toMatchObject({
      code: "not_attempted",
      detail: "stored 1, already stored 1, failed 0, not attempted 2; run time limit: remaining reports not downloaded before the deadline",
    });
  });

  it("MF-8: a failure and a deadline cut together: the failure wins (D-2)", async () => {
    const links = [link("https://x/fail.pdf", "d1"), link("https://x/never.pdf", "d2")];
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: async () => ({ status: "found", ...links[0], links, truncated: false }),
      download: async () => ({ ok: false, kind: "http_error", httpStatus: 500, message: "boom" }),
      extractText: async () => ({ ok: true, text: "unused" }),
      registry: { get: () => ({ key: "fake-filing", fieldKeys: [], canHandle: () => true, extract: () => ({ ok: false as const, error: "unused" }) }) },
      store,
      canStartDownload: () => false,
      ...linkDeps(),
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome.code).toBe("fetch_error");
  });

  it("MF-9: the first PDF is never guarded, even when canStartDownload is always false", async () => {
    const links = [link("https://x/only.pdf", "d1")];
    const store = new FakeStore();
    const deps = filingDeps({ links, store, textFor: () => "REPORT_DATE:2026-09-20", canStartDownload: () => false });
    const outcome = await ingestEtf(etf, deps);
    expect(outcome.code).toBe("ok");
  });
});
