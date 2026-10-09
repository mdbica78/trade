import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { AdapterRegistry } from "./adapters/types";
import { validateExtractionResult } from "./adapters/validate";
import type { DiscoveryResult } from "./discovery";
import type { PdfDownloadResult, PdfTextResult } from "./pdf";

export type ReportLatestEtf = { symbol: string; bvbUrl: string; adapterKey: string | null };

export type ReportLatestDeps = {
  etfs: readonly ReportLatestEtf[];
  registry: Pick<AdapterRegistry, "get">;
  discover: (etf: { symbol: string; bvbUrl: string }) => Promise<DiscoveryResult>;
  download: (url: string) => Promise<PdfDownloadResult>;
  extractText: (bytes: Uint8Array) => Promise<PdfTextResult>;
  writeFileExclusive: (filePath: string, bytes: Uint8Array) => Promise<"written" | "exists">;
  fixturesDir: string;
};

export type ReportLatestOutcome = {
  exitCode: number;
  stdout: string[];
  stderr: string[];
  report?: {
    pdfUrl: string;
    reportDate: string;
    values: readonly { fieldKey: string; rawValue: string; numericValue: string }[];
    missingFields: readonly string[];
    savedPath?: string;
  };
};

const FILE_NAME_RE = /^[A-Z0-9]+-\d{4}-\d{2}-\d{2}\.pdf$/;

export async function defaultWriteFileExclusive(filePath: string, bytes: Uint8Array): Promise<"written" | "exists"> {
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    return "written";
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST") {
      return "exists";
    }
    throw error;
  }
}

type ParsedArgs = { symbol: string; save: boolean } | { error: string };

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv[0] === "--" ? argv.slice(1) : [...argv];
  const positional: string[] = [];
  let save = false;

  for (const arg of args) {
    if (arg === "--save") {
      save = true;
    } else if (arg.startsWith("--")) {
      return { error: `unknown flag "${arg}". Usage: report-latest <SYMBOL> [--save]` };
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    return { error: "usage: report-latest <SYMBOL> [--save]" };
  }

  return { symbol: positional[0], save };
}

export async function runReportLatest(
  argv: readonly string[],
  deps: ReportLatestDeps,
): Promise<ReportLatestOutcome> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  try {
    const parsed = parseArgs(argv);
    if ("error" in parsed) {
      stderr.push(parsed.error);
      return { exitCode: 1, stdout, stderr };
    }
    const { symbol, save } = parsed;

    const etf = deps.etfs.find((e) => e.symbol === symbol);
    if (!etf) {
      const known = deps.etfs.map((e) => e.symbol).join(", ");
      stderr.push(`unknown symbol "${symbol}". Known symbols: ${known}`);
      return { exitCode: 1, stdout, stderr };
    }

    stdout.push(`symbol: ${etf.symbol}`);
    stdout.push(`adapter key: ${etf.adapterKey ?? "(none)"}`);

    const discovery = await deps.discover({ symbol: etf.symbol, bvbUrl: etf.bvbUrl });
    if (discovery.status === "error") {
      stderr.push(`discovery failed for ${etf.symbol}: ${discovery.message}`);
      return { exitCode: 1, stdout, stderr };
    }
    if (discovery.status === "not_found") {
      stderr.push(
        discovery.reason === "list_not_found"
          ? `discovery failed for ${etf.symbol}: no depositary report list found on the instrument page`
          : `discovery failed for ${etf.symbol}: no depositary report entries found`,
      );
      return { exitCode: 1, stdout, stderr };
    }

    stdout.push(`PDF URL: ${discovery.pdfUrl}`);
    stdout.push(`filed on BVB at: ${discovery.publishedAt ?? "(unknown)"}`);

    const download = await deps.download(discovery.pdfUrl);
    if (!download.ok) {
      stderr.push(`download failed for ${etf.symbol}: ${download.message}`);
      return { exitCode: 1, stdout, stderr };
    }

    const textResult = await deps.extractText(download.bytes);
    if (!textResult.ok) {
      stderr.push(`text extraction (unreadable) failed for ${etf.symbol}: ${textResult.message}`);
      return { exitCode: 1, stdout, stderr };
    }

    const adapter = deps.registry.get(etf.adapterKey);
    if (!adapter) {
      stderr.push(`extraction unavailable for ${etf.symbol}: no adapter registered for key "${etf.adapterKey ?? ""}"`);
      return { exitCode: 1, stdout, stderr };
    }

    const result = adapter.extract(textResult.text);
    if (!result.ok) {
      stderr.push(`adapter "${adapter.key}" failed for ${etf.symbol}: ${result.error}`);
      return { exitCode: 1, stdout, stderr };
    }

    const violations = validateExtractionResult(adapter, result);
    if (violations.length > 0) {
      stderr.push(
        `adapter "${adapter.key}" produced an invalid result for ${etf.symbol}: ${violations
          .map((v) => v.message)
          .join("; ")}`,
      );
      return { exitCode: 1, stdout, stderr };
    }

    stdout.push(`report date (from PDF): ${result.reportDate}`);
    const valuesByKey = new Map(result.values.map((v) => [v.fieldKey, v]));
    for (const fieldKey of adapter.fieldKeys) {
      const value = valuesByKey.get(fieldKey);
      stdout.push(value ? `${fieldKey}: ${value.rawValue} (${value.numericValue})` : `${fieldKey}: MISSING`);
    }

    let exitCode = 0;
    if (result.missingFields.length > 0) {
      stderr.push(`warning: ${result.missingFields.length} field(s) missing: ${result.missingFields.join(", ")}`);
      exitCode = 1;
    }

    let savedPath: string | undefined;
    if (save) {
      const fileName = `${etf.symbol}-${result.reportDate}.pdf`;
      if (!FILE_NAME_RE.test(fileName)) {
        stderr.push(`refusing to save: computed file name "${fileName}" is not well-formed`);
        return { exitCode: 1, stdout, stderr };
      }
      const filePath = path.join(deps.fixturesDir, fileName);
      const writeOutcome = await deps.writeFileExclusive(filePath, download.bytes);
      if (writeOutcome === "exists") {
        stderr.push(`refusing to overwrite existing fixture: ${filePath}`);
        return { exitCode: 1, stdout, stderr };
      }
      savedPath = filePath;
      stdout.push(`saved: ${filePath}`);
    }

    return {
      exitCode,
      stdout,
      stderr,
      report: {
        pdfUrl: discovery.pdfUrl,
        reportDate: result.reportDate,
        values: result.values,
        missingFields: result.missingFields,
        savedPath,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.push(`unexpected error: ${message}`);
    return { exitCode: 1, stdout, stderr };
  }
}
