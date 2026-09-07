import type { BVBService } from '../bvb';
import type { PDFService } from '../pdf';

export class ETFService {
  constructor(
    private readonly bvbService: BVBService,
    private readonly pdfService: PDFService,
  ) {}

  async synchronize(_etfSymbol: string): Promise<void> {
    throw new Error("Not implemented");
  }
}
