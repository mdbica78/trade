import type { BVBService } from '../bvb';
import { ConfigService } from '../config/service';
import { DatabaseService } from '../db';
import type { PDFService } from '../pdf';

export class ETFService {
  constructor(
    private readonly bvbService: BVBService,
    private readonly pdfService: PDFService,
  ) {}

  async synchronize(): Promise<void> {
    const configService = new ConfigService();
    const database = new DatabaseService();
    const syncRunId = database.createSyncRun();

    try {
      const symbols = configService.getMonitoredEtfs();

      for (const symbol of symbols) {
        try {
          const report = await this.bvbService.getLatestReport(symbol);
          if (!report) {
            continue;
          }

          const buffer = await this.bvbService.downloadReport(report);
          const text = await this.pdfService.parse(buffer);
          const unitsInCirculation = this.pdfService.extractUnitsInCirculation(text);
          const latest = database.getLatestHistory(symbol);
          if (!latest) {
            database.insertHistory({
              symbol,
              reportDate: report.reportDate,
              unitsInCirculation,
              vuan: null,
              netAssets: null,
              reportUrl: report.reportUrl,
            });
          } else if (
            latest.report_date.substring(0, 10) !== report.reportDate.toISOString().substring(0, 10)
          ) {
            database.insertHistory({
              symbol,
              reportDate: report.reportDate,
              unitsInCirculation,
              vuan: null,
              netAssets: null,
              reportUrl: report.reportUrl,
            });
          } else {
            database.updateHistory({
              symbol,
              reportDate: new Date(latest.report_date),
              unitsInCirculation,
              vuan: null,
              netAssets: null,
              reportUrl: report.reportUrl,
            });
          }
        } catch (error: unknown) {
          const parsedError = error instanceof Error ? error : new Error(String(error));
          console.error(
            `Failed to synchronize ETF ${symbol}: ${parsedError.message}`,
            parsedError.stack,
          );
        }
      }

      database.markSyncRunCompleted(syncRunId);
    } catch (error: unknown) {
      throw error;
    }
  }
}
