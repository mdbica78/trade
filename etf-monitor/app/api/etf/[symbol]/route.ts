import { BVBService } from '@/lib/bvb';
import { PDFService } from '@/lib/pdf';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const bvbService = new BVBService();
  const pdfService = new PDFService();

  const report = await bvbService.getLatestReport(symbol);
  if (!report) {
    return NextResponse.json({ error: 'Latest report not found' }, { status: 404 });
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

  return NextResponse.json(
    {
      symbol,
      reportDate: report.reportDate,
      unitsInCirculation,
      vuan,
      netAssets,
      reportUrl: report.reportUrl,
    },
    { status: 200 },
  );
}
