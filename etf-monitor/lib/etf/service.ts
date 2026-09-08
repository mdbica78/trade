import type { BVBService } from '../bvb';
import type { PDFService } from '../pdf';

export class ETFService {
  constructor(
    private readonly bvbService: BVBService,
    private readonly pdfService: PDFService,
  ) {}

  async synchronize(): Promise<void> {
    const etfs = await this.bvbService.getEtfs();

    for (const etf of etfs) {
      try {
        const report = await this.bvbService.getLatestReport(etf.symbol);
        if (!report) {
          continue;
        }

        const buffer = await this.bvbService.downloadReport(report);
        const text = await this.pdfService.parse(buffer);
        const unitsInCirculation = this.pdfService.extractUnitsInCirculation(text);

        console.log(
          JSON.stringify({
            symbol: etf.symbol,
            reportDate: report.reportDate,
            unitsInCirculation,
          }),
        );
      } catch (error: unknown) {
        const parsedError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Failed to synchronize ETF ${etf.symbol}: ${parsedError.message}`,
          parsedError.stack,
        );
      }
    }
  }
}
