import pdfParse from 'pdf-parse';
import type { MonitoredField } from '../config/service';

function parseLocalizedNumber(rawValue: string): number {
  const compact = rawValue.replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();
  if (!compact) {
    throw new Error('Failed to parse numeric value');
  }

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  let normalized = compact;

  if (commaCount > 0 && dotCount > 0) {
    if (compact.lastIndexOf(',') > compact.lastIndexOf('.')) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = compact.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      const parts = compact.split(',');
      const usesThousandsGrouping = parts.slice(1).every((part) => part.length === 3);
      normalized = usesThousandsGrouping ? parts.join('') : compact.replace(/,/g, '');
    } else {
      const [integerPart, fractionalPart = ''] = compact.split(',');
      if (fractionalPart.length === 3) {
        normalized = `${integerPart}${fractionalPart}`;
      } else {
        normalized = compact.replace(',', '.');
      }
    }
  } else if (dotCount > 0) {
    if (dotCount > 1) {
      const parts = compact.split('.');
      const usesThousandsGrouping = parts.slice(1).every((part) => part.length === 3);
      if (usesThousandsGrouping) {
        normalized = parts.join('');
      } else {
        const lastDotIndex = compact.lastIndexOf('.');
        normalized =
          compact.slice(0, lastDotIndex).replace(/\./g, '') + compact.slice(lastDotIndex);
      }
    } else {
      const [integerPart, fractionalPart = ''] = compact.split('.');
      if (fractionalPart.length === 3) {
        normalized = `${integerPart}${fractionalPart}`;
      }
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('Failed to parse numeric value');
  }

  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PDFService {
  async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await pdfParse(buffer);
      return result.text;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
      throw new Error('Failed to parse PDF');
    }
  }

  extractText(buffer: Buffer): Promise<string> {
    return this.parse(buffer);
  }

  extractMetricValue(text: string, field: MonitoredField): number {
    if (field.extractorKey === 'units_in_circulation') {
      return this.extractUnitsInCirculation(text);
    }

    if (field.extractorKey === 'vuan') {
      return this.extractVUAN(text);
    }

    if (field.extractorKey === 'net_assets') {
      return this.extractNetAssets(text);
    }

    if (field.extractorKey === 'regex_label_number') {
      const label = field.extractionHint?.trim() ?? '';
      if (!label) {
        throw new Error(`Missing extraction hint for metric ${field.fieldName}`);
      }

      const patternText =
        field.extractionPattern?.trim() ||
        `${escapeRegExp(label)}[^0-9+-]*([+-]?[0-9][0-9.,\\s\\u00A0]*)`;
      const pattern = new RegExp(patternText, 'i');
      const match = text.match(pattern);
      if (!match || !match[1]) {
        throw new Error(`Failed to extract metric ${field.fieldName}`);
      }

      return parseLocalizedNumber(match[1]);
    }

    throw new Error(`Unsupported extractor key for metric ${field.fieldName}`);
  }

  extractUnitsInCirculation(text: string): number {
    const marker = 'NUMAR U.F. in circulatie';
    const markerIndex = text.toUpperCase().indexOf(marker.toUpperCase());
    if (markerIndex < 0) {
      throw new Error('Failed to extract units in circulation');
    }

    const sliceWindow = text.slice(markerIndex, markerIndex + 200);
    const firstColonIndex = sliceWindow.indexOf(':');
    if (firstColonIndex < 0) {
      throw new Error('Failed to extract units in circulation');
    }

    const afterColon = sliceWindow.slice(firstColonIndex + 1);
    const numberMatch = afterColon.match(/[0-9][0-9.,\s]*/);
    if (!numberMatch) {
      throw new Error('Failed to extract units in circulation');
    }

    const digitsOnly = numberMatch[0].replace(/\D/g, '');
    if (!digitsOnly) {
      throw new Error('Failed to extract units in circulation');
    }

    return Number.parseInt(digitsOnly, 10);
  }

  extractVUAN(text: string): number {
    const patterns = [
      /VALOARE\s+UNITARA\s+A\s+ACTIVULUI\s+NET\s*\(VUAN\)[^\r\n]*?([+-]?[0-9]+[.,][0-9]+)/i,
      /Persoane\s+juridice\s+[0-9][0-9.,\s\u00A0]*?\s+([+-]?[0-9]+[.,][0-9]+)\s+Numar\s+investitori/i,
      /NUMAR\s+U\.F\.\s+in\s+circulatie[\s\S]*?Persoane\s+juridice[\s\S]*?([+-]?[0-9]+[.,][0-9]+)\s*Numar\s+investitori/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match || !match[1]) {
        continue;
      }

      try {
        return parseLocalizedNumber(match[1]);
      } catch {
        continue;
      }
    }

    throw new Error('Failed to extract VUAN');
  }

  extractNetAssets(text: string): number {
    const patterns = [
      /ACTIV\s+NET\s*\(in\s+valuta\s+clasa\s+UF\s*-\s*RON\)\s*([+-]?[0-9][0-9.,\s\u00A0]*)/i,
      /ACTIV\s+NET\s*\(in\s+valuta\s+fond\s*-\s*RON\)\s*([+-]?[0-9][0-9.,\s\u00A0]*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match || !match[1]) {
        continue;
      }

      try {
        return parseLocalizedNumber(match[1]);
      } catch {
        continue;
      }
    }

    throw new Error('Failed to extract net assets');
  }
}
