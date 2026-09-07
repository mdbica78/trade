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
}
