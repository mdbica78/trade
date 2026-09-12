import { BVBService } from '@/lib/bvb';
import { ConfigService } from '@/lib/config/service';
import { PDFService } from '@/lib/pdf';
import { NextResponse } from 'next/server';

function isFiniteMetricValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export async function GET() {
  const bvbService = new BVBService();
  const pdfService = new PDFService();
  const configService = new ConfigService();
  const monitoredEtfs = await configService.getEnabledMonitoredEtfs();
  const enabledFields = await configService.getEnabledMonitoredFields();

  const settledResults = await Promise.allSettled(
    monitoredEtfs.map(async (etf) => {
      const report = await bvbService.getLatestReport(etf.bvbSymbol);
      if (!report) {
        return null;
      }

      const reportBuffer = await bvbService.downloadReport(report);
      const parsedText = await pdfService.parse(reportBuffer);
      const metrics: Record<string, number | null> = {};

      for (const field of enabledFields) {
        try {
          const value = pdfService.extractMetricValue(parsedText, field);
          metrics[field.fieldName] = isFiniteMetricValue(value) ? value : null;
        } catch {
          metrics[field.fieldName] = null;
        }
      }

      return {
        symbol: etf.symbol,
        bvbSymbol: etf.bvbSymbol,
        reportDate: report.reportDate,
        reportUrl: report.reportUrl,
        metrics,
      };
    }),
  );

  settledResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const etf = monitoredEtfs[index];
      const error =
        result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      console.error(
        'ETF processing failed',
        JSON.stringify(
          {
            symbol: etf?.symbol,
            stage: 'api-etf-list',
            message: error.message,
            stack: error.stack,
          },
          null,
          2,
        ),
      );
    }
  });

  const successfulResults = settledResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((result) => result !== null);

  return NextResponse.json(successfulResults, { status: 200 });
}
