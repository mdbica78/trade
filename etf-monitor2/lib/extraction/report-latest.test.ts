import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterRegistry, ExtractionAdapter, ExtractionResult } from "./adapters/types";
import { defaultAdapterRegistry } from "./adapters/default-registry";
import type { DiscoveryResult } from "./discovery";
import { extractPdfText } from "./pdf";
import type { PdfDownloadResult, PdfTextResult } from "./pdf";
import {
  defaultWriteFileExclusive,
  runReportLatest,
  type ReportLatestDeps,
  type ReportLatestEtf,
} from "./report-latest";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures");

function readPdfFixture(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

const ETFS: ReportLatestEtf[] = [
  { symbol: "BTBETRETF", bvbUrl: "https://bvb.ro/BTBETRETF", adapterKey: "brd-depositary" },
  { symbol: "TVBETETF", bvbUrl: "https://bvb.ro/TVBETETF", adapterKey: "brd-depositary" },
];

const FOUND_DISCOVERY: DiscoveryResult = {
  status: "found",
  pdfUrl: "https://bvb.ro/reports/BTBETRETF-2026-09-21.pdf",
  title: "VAN la data 21.09.2026",
  publishedAt: "2026-09-22T09:25:00",
};

const OK_TEXT_RESULT: PdfTextResult = { ok: true, text: "some report text" };

const OK_DOWNLOAD_RESULT: PdfDownloadResult = {
  ok: true,
  bytes: new Uint8Array([1, 2, 3]),
  fetchedAt: new Date("2026-09-22T09:00:00Z"),
};

function stubAdapter(overrides: { extract: (text: string) => ExtractionResult }): ExtractionAdapter {
  return {
    key: "brd-depositary",
    fieldKeys: ["net_asset", "units_in_circulation"],
    canHandle: () => true,
    extract: overrides.extract,
  };
}

function stubRegistry(adapter: ExtractionAdapter | undefined): Pick<AdapterRegistry, "get"> {
  return { get: () => adapter };
}

const FULL_OK_RESULT: ExtractionResult = {
  ok: true,
  reportDate: "2026-09-21",
  values: [
    { fieldKey: "net_asset", rawValue: "415,591,664.27", numericValue: "415591664.27" },
    { fieldKey: "units_in_circulation", rawValue: "37,470,000", numericValue: "37470000" },
  ],
  missingFields: [],
};

function makeDeps(overrides: Partial<ReportLatestDeps> = {}): ReportLatestDeps {
  return {
    etfs: ETFS,
    registry: stubRegistry(stubAdapter({ extract: () => FULL_OK_RESULT })),
    discover: vi.fn(async () => FOUND_DISCOVERY),
    download: vi.fn(async () => OK_DOWNLOAD_RESULT),
    extractText: vi.fn(async () => OK_TEXT_RESULT),
    writeFileExclusive: vi.fn(async () => "written" as const),
    fixturesDir: "/fixtures",
    ...overrides,
  };
}

describe("runReportLatest: success", () => {
  it("returns the URL, date and values without --save", async () => {
    const deps = makeDeps();
    const outcome = await runReportLatest(["BTBETRETF"], deps);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.report).toEqual({
      pdfUrl: FOUND_DISCOVERY.pdfUrl,
      reportDate: "2026-09-21",
      values: FULL_OK_RESULT.values,
      missingFields: [],
      savedPath: undefined,
    });
    expect(outcome.stdout.join("\n")).toContain(FOUND_DISCOVERY.pdfUrl);
    expect(outcome.stdout.join("\n")).toContain("2026-09-21");
    expect(outcome.stdout.join("\n")).toContain("415,591,664.27");
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
    expect(deps.discover).toHaveBeenCalledTimes(1);
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it("wiring test: real extractPdfText + defaultAdapterRegistry against the committed BTBETRETF fixture", async () => {
    const deps = makeDeps({
      registry: defaultAdapterRegistry,
      download: vi.fn(async () => ({
        ok: true as const,
        bytes: readPdfFixture("BTBETRETF-2026-09-21.pdf"),
        fetchedAt: new Date(),
      })),
      extractText: extractPdfText,
    });

    const outcome = await runReportLatest(["BTBETRETF"], deps);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.report?.reportDate).toBe("2026-09-21");
    const out = outcome.stdout.join("\n");
    expect(out).toContain("415,591,664.27");
    expect(out).toContain("37,470,000");
    expect(out).toContain("29,733,778");
    expect(out).toContain("7,736,222");
    expect(out).toContain("11.091");
    expect(out).toContain("18,708");
    expect(out).toContain("18,631");
    expect(out).toContain("77");
  });
});

describe("runReportLatest: failures (all run with --save, none should write a file)", () => {
  it("unknown symbol: discover is not called, message lists known symbols", async () => {
    const deps = makeDeps();
    const outcome = await runReportLatest(["NOPE", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("NOPE");
    expect(outcome.stderr.join("\n")).toContain("BTBETRETF");
    expect(deps.discover).not.toHaveBeenCalled();
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  const discoveryErrorCases: { kind: "http_error" | "network" | "timeout" }[] = [
    { kind: "http_error" },
    { kind: "network" },
    { kind: "timeout" },
  ];
  it.each(discoveryErrorCases)("discovery error: $kind", async ({ kind }) => {
    const deps = makeDeps({
      discover: vi.fn(async () => ({ status: "error", kind, message: `discovery ${kind} failed` }) as DiscoveryResult),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("discovery");
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  const notFoundReasons: { reason: "no_report_entries" | "list_not_found" }[] = [
    { reason: "no_report_entries" },
    { reason: "list_not_found" },
  ];
  it.each(notFoundReasons)("discovery not_found: $reason", async ({ reason }) => {
    const deps = makeDeps({
      discover: vi.fn(async () => ({ status: "not_found", reason }) as DiscoveryResult),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("no depositary report");
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  const downloadErrorCases: { kind: "http_error" | "network" | "timeout" | "not_pdf" }[] = [
    { kind: "http_error" },
    { kind: "network" },
    { kind: "timeout" },
    { kind: "not_pdf" },
  ];
  it.each(downloadErrorCases)("download error: $kind", async ({ kind }) => {
    const deps = makeDeps({
      download: vi.fn(async () => ({ ok: false, kind, message: `download ${kind} failed` }) as PdfDownloadResult),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("download");
    expect(deps.extractText).not.toHaveBeenCalled();
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  it("text extraction unreadable", async () => {
    const deps = makeDeps({
      extractText: vi.fn(async () => ({ ok: false, kind: "unreadable", message: "no text" }) as PdfTextResult),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("unreadable");
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  it("adapter ok: false", async () => {
    const deps = makeDeps({
      registry: stubRegistry(stubAdapter({ extract: () => ({ ok: false, error: "no date found" }) })),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("adapter");
    expect(outcome.stderr.join("\n")).toContain("no date found");
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  it("adapter result with contract violations", async () => {
    const deps = makeDeps({
      registry: stubRegistry(
        stubAdapter({
          extract: () => ({
            ok: true,
            reportDate: "not-a-date",
            values: [],
            missingFields: ["net_asset", "units_in_circulation"],
          }),
        }),
      ),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  it("adapterKey resolves to no adapter: extraction unavailable", async () => {
    const deps = makeDeps({ registry: stubRegistry(undefined) });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("unavailable");
    expect(deps.writeFileExclusive).not.toHaveBeenCalled();
  });

  it("no symbol argument: usage message", async () => {
    const deps = makeDeps();
    const outcome = await runReportLatest([], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("usage");
    expect(deps.discover).not.toHaveBeenCalled();
  });

  it("unknown flag: usage message", async () => {
    const deps = makeDeps();
    const outcome = await runReportLatest(["BTBETRETF", "--bogus"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("unknown flag");
    expect(deps.discover).not.toHaveBeenCalled();
  });

  it("partial extraction (R6): missing field, exit 1, warning, but --save still writes", async () => {
    const deps = makeDeps({
      registry: stubRegistry(
        stubAdapter({
          extract: () => ({
            ok: true,
            reportDate: "2026-09-21",
            values: [{ fieldKey: "net_asset", rawValue: "1", numericValue: "1" }],
            missingFields: ["units_in_circulation"],
          }),
        }),
      ),
    });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain("units_in_circulation");
    expect(deps.writeFileExclusive).toHaveBeenCalledTimes(1);
  });
});

describe("runReportLatest: --save", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes <SYMBOL>-<reportDate>.pdf using the date from the PDF, with the downloaded bytes", async () => {
    const bytes = new Uint8Array([9, 9, 9]);
    const deps = makeDeps({
      discover: vi.fn(async () => ({
        status: "found",
        pdfUrl: "https://bvb.ro/x.pdf",
        title: "VAN la data 20.09.2026",
        publishedAt: "2026-09-22T09:25:00",
      })) as unknown as ReportLatestDeps["discover"],
      download: vi.fn(async () => ({ ok: true as const, bytes, fetchedAt: new Date() })),
    });

    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).toBe(0);
    expect(deps.writeFileExclusive).toHaveBeenCalledTimes(1);
    expect(deps.writeFileExclusive).toHaveBeenCalledWith(
      path.join("/fixtures", "BTBETRETF-2026-09-21.pdf"),
      bytes,
    );
    expect(outcome.stdout.join("\n")).toContain(path.join("/fixtures", "BTBETRETF-2026-09-21.pdf"));
  });

  it("refuses to overwrite an existing file", async () => {
    const deps = makeDeps({ writeFileExclusive: vi.fn(async () => "exists" as const) });
    const outcome = await runReportLatest(["BTBETRETF", "--save"], deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join("\n")).toContain(path.join("/fixtures", "BTBETRETF-2026-09-21.pdf"));
  });
});

describe("defaultWriteFileExclusive (real fs, offline)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "report-latest-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes on first call, refuses to overwrite on second, keeps original bytes", async () => {
    const filePath = path.join(tmpDir, "a.pdf");
    const first = await defaultWriteFileExclusive(filePath, new Uint8Array([1, 2, 3]));
    expect(first).toBe("written");

    const second = await defaultWriteFileExclusive(filePath, new Uint8Array([9, 9, 9]));
    expect(second).toBe("exists");

    const content = await readFile(filePath);
    expect([...content]).toEqual([1, 2, 3]);
  });
});

describe("no DB access (AC6)", () => {
  it("report-latest.ts imports no DB or drizzle module", () => {
    const source = readFileSync(path.join(__dirname, "report-latest.ts"), "utf8");
    expect(/from\s+["'][^"']*\/db(\/index)?["']/.test(source)).toBe(false);
    expect(/drizzle-orm/.test(source)).toBe(false);
    expect(/@neondatabase\/serverless/.test(source)).toBe(false);
  });
});
