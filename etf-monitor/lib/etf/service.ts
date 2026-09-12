import type { BVBService } from '../bvb';
import { ConfigService, type MonitoredField, type MonitoredEtf } from '../config/service';
import { DatabaseService } from '../db';
import type { PDFService } from '../pdf';
import type { DynamicMetricValueMap } from '../types';

function isValidReportDate(reportDate: Date): boolean {
  if (Number.isNaN(reportDate.getTime())) {
    return false;
  }

  const now = Date.now();
  const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
  return reportDate.getTime() >= Date.UTC(2000, 0, 1) && reportDate.getTime() <= now + oneDayInMilliseconds;
}

function isValidMetricValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function hasAtLeastOneExtractedMetric(metrics: DynamicMetricValueMap): boolean {
  return Object.values(metrics).some((value) => value !== null);
}

function normalizeConfiguredSymbol(etf: MonitoredEtf): string {
  return etf.bvbSymbol.trim().toUpperCase();
}

export class ETFService {
  constructor(
    private readonly bvbService: BVBService,
    private readonly pdfService: PDFService,
  ) {}

  async synchronize(): Promise<void> {
    const configService = new ConfigService();
    const database = new DatabaseService();
    const syncRunId = await database.createSyncRun();

    try {
      const monitoredEtfs = await configService.getEnabledMonitoredEtfs();
      const enabledFields = await configService.getEnabledMonitoredFields();

      if (enabledFields.length === 0) {
        throw new Error('No monitored fields are enabled');
      }

      let hasFailures = false;

      for (const monitoredEtf of monitoredEtfs) {
        const symbol = monitoredEtf.symbol;
        const bvbSymbol = normalizeConfiguredSymbol(monitoredEtf);
        let stage = 'fetch-latest-report';
        try {
          stage = 'fetch-latest-report';
          const report = await this.bvbService.getLatestReport(bvbSymbol);
          if (!report) {
            console.error(`Failed to synchronize ETF ${symbol}: report not found`);
            hasFailures = true;
            continue;
          }

          if (report.etfSymbol !== bvbSymbol) {
            throw new Error(`Unexpected report ETF symbol ${report.etfSymbol}`);
          }
          if (!isValidReportDate(report.reportDate)) {
            throw new Error(`Invalid report date ${report.reportDate.toISOString()}`);
          }

          stage = 'check-existing-history';
          const existingForReportDate = await database.getHistoryForReportDate(symbol, report.reportDate);
          const shouldUpdateExistingHistory = Boolean(existingForReportDate);

          stage = 'download-report';
          const buffer = await this.bvbService.downloadReport(report);
          stage = 'parse-pdf';
          const text = await this.pdfService.parse(buffer);

          stage = 'extract-metrics';
          const metrics = await this.extractMetricsForReport(symbol, enabledFields, text);
          if (!hasAtLeastOneExtractedMetric(metrics)) {
            throw new Error('No valid metric values could be extracted');
          }

          if (shouldUpdateExistingHistory) {
            stage = 'update-history';
            await database.updateHistory({
              symbol,
              reportDate: report.reportDate,
              metrics,
              reportUrl: report.reportUrl,
            });
          } else {
            stage = 'insert-history';
            await database.insertHistory({
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
            `Failed to synchronize ETF ${symbol} at ${stage}: ${parsedError.message}`,
            parsedError.stack,
          );
        }
      }

      if (hasFailures) {
        throw new Error('Synchronization failed for one or more ETFs');
      }

      await database.markSyncRunCompleted(syncRunId);
    } catch (error: unknown) {
      await database.markSyncRunFailed(syncRunId);
      throw error;
    }
  }

  private async extractMetricsForReport(
    symbol: string,
    enabledFields: MonitoredField[],
    text: string,
  ): Promise<DynamicMetricValueMap> {
    const metrics: DynamicMetricValueMap = {};

    for (const field of enabledFields) {
      try {
        const extractedValue = this.pdfService.extractMetricValue(text, field);
        if (!isValidMetricValue(extractedValue)) {
          throw new Error('Extracted value is invalid');
        }
        metrics[field.fieldName] = extractedValue;
      } catch (error: unknown) {
        const parsedError = error instanceof Error ? error : new Error(String(error));
        metrics[field.fieldName] = null;
        console.error(
          `Metric extraction failed for ETF ${symbol} at ${field.fieldName}: ${parsedError.message}`,
          parsedError.stack,
        );
      }
    }

    return metrics;
  }
}
