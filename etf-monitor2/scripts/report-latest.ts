import path from "node:path";
import { defaultAdapterRegistry } from "../lib/extraction/adapters/default-registry";
import { discoverLatestReport } from "../lib/extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../lib/extraction/pdf";
import { defaultWriteFileExclusive, runReportLatest } from "../lib/extraction/report-latest";
import { seedEtfs } from "../lib/db/seed-data";

const deps = {
  etfs: seedEtfs,
  registry: defaultAdapterRegistry,
  discover: (etf: { symbol: string; bvbUrl: string }) => discoverLatestReport(etf),
  download: (url: string) => downloadReportPdf(url),
  extractText: extractPdfText,
  writeFileExclusive: defaultWriteFileExclusive,
  fixturesDir: path.join(process.cwd(), "test", "fixtures"),
};

runReportLatest(process.argv.slice(2), deps).then((outcome) => {
  for (const line of outcome.stdout) {
    console.log(line);
  }
  for (const line of outcome.stderr) {
    console.error(line);
  }
  process.exitCode = outcome.exitCode;
});
