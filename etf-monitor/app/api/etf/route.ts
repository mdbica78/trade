import { BVBService } from '@/lib/bvb';
import { PDFService } from '@/lib/pdf';
import { NextResponse } from 'next/server';

const MONITORED_ETFS = ['TVBETETF', 'PTENGETF', 'BTBETRETF', 'ICBETNETF'] as const;

export async function GET() {
  const bvbService = new BVBService();
  const pdfService = new PDFService();

  const settledResults = await Promise.allSettled(
    MONITORED_ETFS.map(async (symbol) => {
      const report = await bvbService.getLatestReport(symbol);
      if (!report) {
        return null;
      }

      const reportBuffer = await bvbService.downloadReport(report);
      const parsedText = await pdfService.parse(reportBuffer);
      const unitsInCirculation = pdfService.extractUnitsInCirculation(parsedText);

      return {
        symbol,
        reportDate: report.reportDate,
        unitsInCirculation,
        reportUrl: report.reportUrl,
      };
    }),
  );

  const successfulResults = settledResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((result) => result !== null);

  return NextResponse.json(successfulResults, { status: 200 });
}
