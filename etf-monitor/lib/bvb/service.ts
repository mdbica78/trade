import type { ETF, Report } from '../types';

const FUND_UNITS_EXPORT_URL =
  'https://www.bvb.ro/FinancialInstruments/Markets/FundUnitsListForDownload.ashx?filetype=txt';
const BVB_BASE_URL = 'https://www.bvb.ro';
const BVB_DETAILS_URL =
  'https://www.bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=';

function parseRoDate(dateText: string): Date | null {
  const match = dateText.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  return new Date(Date.UTC(year, month - 1, day));
}

function extractReportDate(title: string, reportUrl: string, rowHtml: string): Date | null {
  const titleDateMatch = title.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (titleDateMatch) {
    const parsedFromTitle = parseRoDate(titleDateMatch[1]);
    if (parsedFromTitle) {
      return parsedFromTitle;
    }
  }

  const urlDateMatch = reportUrl.match(/(\d{2})-(\d{2})-(\d{4})(?=\.pdf)/i);
  if (urlDateMatch) {
    const parsedFromUrl = parseRoDate(
      `${urlDateMatch[1]}.${urlDateMatch[2]}.${urlDateMatch[3]}`,
    );
    if (parsedFromUrl) {
      return parsedFromUrl;
    }
  }

  const publicationDateMatch = rowHtml.match(/<p class="date[^"]*">\s*(\d{2}\.\d{2}\.\d{4})/i);
  if (publicationDateMatch) {
    return parseRoDate(publicationDateMatch[1]);
  }

  return null;
}

function extractHrefAttribute(rowHtml: string): string | null {
  const anchorStart = rowHtml.indexOf('<a ');
  if (anchorStart < 0) {
    return null;
  }

  const hrefIndex = rowHtml.indexOf('href=', anchorStart);
  if (hrefIndex < 0) {
    return null;
  }

  const quote = rowHtml[hrefIndex + 5];
  if (quote !== "'" && quote !== '"') {
    return null;
  }

  const valueStart = hrefIndex + 6;
  const valueEnd = rowHtml.indexOf(quote, valueStart);
  if (valueEnd < 0) {
    return null;
  }

  return rowHtml.slice(valueStart, valueEnd).trim();
}

function normalizeReportUrl(href: string): string | null {
  try {
    const parsed = new URL(href, BVB_BASE_URL);
    if (parsed.protocol !== 'https:') {
      return null;
    }

    if (parsed.host !== 'bvb.ro' && parsed.host !== 'www.bvb.ro') {
      return null;
    }

    if (!parsed.pathname.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    return `https://bvb.ro${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export class BVBService {
  async getEtfs(): Promise<ETF[]> {
    const response = await fetch(FUND_UNITS_EXPORT_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ETFs from BVB. Status: ${response.status}`);
    }

    const content = await response.text();
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const dataLines = lines.slice(1);
    const etfs: ETF[] = [];

    for (const line of dataLines) {
      const columns = line.split('\t');
      const symbol = columns[0]?.trim();
      const name = columns[1]?.trim();
      const isin = columns[2]?.trim();
      const type = columns[7]?.trim();

      if (!symbol || !name || !isin || !type) {
        continue;
      }

      if (!type.startsWith('ETF')) {
        continue;
      }

      etfs.push({ symbol, name, isin });
    }

    return etfs;
  }

  async getLatestReport(etfSymbol: string): Promise<Report | null> {
    const normalizedSymbol = etfSymbol.trim().toUpperCase();
    const response = await fetch(`${BVB_DETAILS_URL}${encodeURIComponent(normalizedSymbol)}`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ETF details for symbol ${normalizedSymbol}. Status: ${response.status}`,
      );
    }

    const html = await response.text();
    const newsTableMatch = html.match(/<table[^>]*id="gv5News"[\s\S]*?<\/table>/i);

    if (!newsTableMatch) {
      return null;
    }

    const rowMatches = newsTableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const reports: Report[] = [];

    for (const rowHtml of rowMatches) {
      const titleMatch = rowHtml.match(/value="([^"]+)"/i);
      const href = extractHrefAttribute(rowHtml);
      if (!titleMatch || !href) {
        continue;
      }

      const title = titleMatch[1];
      const isDailyReport = /VAN la data|VUAN|NAV/i.test(title) || /VUAN/i.test(href);
      if (!isDailyReport) {
        continue;
      }

      const reportUrl = normalizeReportUrl(href);
      if (!reportUrl) {
        continue;
      }

      const reportDate = extractReportDate(title, reportUrl, rowHtml);
      if (!reportDate) {
        continue;
      }

      reports.push({
        id: `${normalizedSymbol}-${reportDate.toISOString()}`,
        etfSymbol: normalizedSymbol,
        reportDate,
        reportUrl,
        downloadedAt: new Date(0),
      });
    }

    if (reports.length === 0) {
      return null;
    }

    reports.sort((a, b) => b.reportDate.getTime() - a.reportDate.getTime());
    return reports[0];
  }

  async downloadReport(_report: Report): Promise<Buffer> {
    const response = await fetch(_report.reportUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to download report. Status: ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }
}
