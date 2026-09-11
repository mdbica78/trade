import { BVBService } from '@/lib/bvb';
import { ConfigService } from '@/lib/config/service';
import { PDFService } from '@/lib/pdf';
import { NextResponse } from 'next/server';

export async function GET() {
  const bvbService = new BVBService();
  const pdfService = new PDFService();
  const configService = new ConfigService();
  const monitoredEtfs = await configService.getMonitoredEtfs();

  const settledResults = await Promise.allSettled(
    monitoredEtfs.map(async (symbol) => {
      const report = await bvbService.getLatestReport(symbol);
      if (!report) {
        return null;
      }

      const reportBuffer = await bvbService.downloadReport(report);
      const parsedText = await pdfService.parse(reportBuffer);
      const unitsInCirculation = pdfService.extractUnitsInCirculation(parsedText);
      let vuan: number | null;
      try {
        vuan = pdfService.extractVUAN(parsedText);
      } catch {
        vuan = null;
      }

      let netAssets: number | null;
      try {
        netAssets = pdfService.extractNetAssets(parsedText);
      } catch {
        netAssets = null;
      }

      return {
        symbol,
        reportDate: report.reportDate,
        unitsInCirculation,
        vuan,
        netAssets,
        reportUrl: report.reportUrl,
      };
    }),
  );

  settledResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const symbol = monitoredEtfs[index];
      const error =
        result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      console.error(
        'ETF processing failed',
        JSON.stringify(
          {
            symbol,
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
