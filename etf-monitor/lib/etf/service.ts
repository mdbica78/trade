import type { BVBService } from '../bvb';
import { ConfigService } from '../config/service';
import { DatabaseService } from '../db';
import type { PDFService } from '../pdf';
import type { MetricValueMap } from '../types';

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
      const enabledFields = new Set(configService.getEnabledFieldNames());
      let hasFailures = false;

      for (const symbol of symbols) {
        try {
          const report = await this.bvbService.getLatestReport(symbol);
          if (!report) {
            continue;
          }

          const buffer = await this.bvbService.downloadReport(report);
          const text = await this.pdfService.parse(buffer);
          const unitsInCirculation = this.pdfService.extractUnitsInCirculation(text);
          const metrics: MetricValueMap = {
            units_in_circulation: unitsInCirculation,
            vuan: null,
            net_assets: null,
          };

          if (enabledFields.has('vuan')) {
            try {
              metrics.vuan = this.pdfService.extractVUAN(text);
            } catch (error: unknown) {
              const parsedError = error instanceof Error ? error : new Error(String(error));
              console.error(
                `VUAN extraction failed for ETF ${symbol}: ${parsedError.message}`,
                parsedError.stack,
              );
            }
          }

          if (enabledFields.has('net_assets')) {
            try {
              metrics.net_assets = this.pdfService.extractNetAssets(text);
            } catch (error: unknown) {
              const parsedError = error instanceof Error ? error : new Error(String(error));
              console.error(
                `Net assets extraction failed for ETF ${symbol}: ${parsedError.message}`,
                parsedError.stack,
              );
            }
          }
          const existingForReportDate = database.getHistoryForReportDate(symbol, report.reportDate);
          if (!existingForReportDate) {
            database.insertHistory({
              symbol,
              reportDate: report.reportDate,
              metrics,
              reportUrl: report.reportUrl,
            });
          } else {
            database.updateHistory({
              symbol,
              reportDate: report.reportDate,
              metrics,
              reportUrl: report.reportUrl,
            });
          }
        } catch (error: unknown) {
          const parsedError = error instanceof Error ? error : new Error(String(error));
          hasFailures = true;
          console.error(
            `Failed to synchronize ETF ${symbol}: ${parsedError.message}`,
            parsedError.stack,
          );
        }
      }

      if (hasFailures) {
        throw new Error('Synchronization failed for one or more ETFs');
      }

      database.markSyncRunCompleted(syncRunId);
    } catch (error: unknown) {
      database.markSyncRunFailed(syncRunId);
      throw error;
    }
  }
}
