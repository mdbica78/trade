import pdfParse from 'pdf-parse';

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
    const marker = 'VUAN';
    const markerIndex = text.toUpperCase().indexOf(marker.toUpperCase());
    if (markerIndex < 0) {
      throw new Error('Failed to extract VUAN');
    }

    const sliceWindow = text.slice(markerIndex, markerIndex + 200);
    const firstColonIndex = sliceWindow.indexOf(':');
    if (firstColonIndex < 0) {
      throw new Error('Failed to extract VUAN');
    }

    const afterColon = sliceWindow.slice(firstColonIndex + 1);
    const numberMatch = afterColon.match(/[0-9][0-9.,\s]*/);
    if (!numberMatch) {
      throw new Error('Failed to extract VUAN');
    }

    const normalized = numberMatch[0].trim().replace(/\s+/g, '');
    if (!normalized) {
      throw new Error('Failed to extract VUAN');
    }

    const decimalNormalized = normalized.replace(',', '.');
    const value = Number(decimalNormalized);
    if (Number.isNaN(value)) {
      throw new Error('Failed to extract VUAN');
    }

    return value;
  }

  extractNetAssets(text: string): number {
    const marker = 'ACTIV NET';
    const markerIndex = text.toUpperCase().indexOf(marker.toUpperCase());
    if (markerIndex < 0) {
      throw new Error('Failed to extract net assets');
    }

    const sliceWindow = text.slice(markerIndex, markerIndex + 200);
    const firstColonIndex = sliceWindow.indexOf(':');
    if (firstColonIndex < 0) {
      throw new Error('Failed to extract net assets');
    }

    const afterColon = sliceWindow.slice(firstColonIndex + 1);
    const numberMatch = afterColon.match(/[0-9][0-9.,\s]*/);
    if (!numberMatch) {
      throw new Error('Failed to extract net assets');
    }

    const normalized = numberMatch[0].trim().replace(/\s+/g, '');
    if (!normalized) {
      throw new Error('Failed to extract net assets');
    }

    let decimalNormalized = normalized;
    const hasComma = decimalNormalized.includes(',');
    const hasDot = decimalNormalized.includes('.');
    if (hasComma && hasDot) {
      if (decimalNormalized.lastIndexOf(',') > decimalNormalized.lastIndexOf('.')) {
        decimalNormalized = decimalNormalized.replace(/\./g, '').replace(',', '.');
      } else {
        decimalNormalized = decimalNormalized.replace(/,/g, '');
      }
    } else if (hasComma) {
      decimalNormalized = decimalNormalized.replace(',', '.');
    }

    const value = Number(decimalNormalized);
    if (Number.isNaN(value)) {
      throw new Error('Failed to extract net assets');
    }

    return value;
  }
}
