import { AIService, MockAIProvider } from './ai';
import { BVBService } from './bvb';
import { ETFService } from './etf';
import { PDFService } from './pdf';

export class App {
  public readonly aiProvider: MockAIProvider;
  public readonly ai: AIService;
  public readonly bvb: BVBService;
  public readonly pdf: PDFService;
  public readonly etf: ETFService;

  constructor() {
    const aiProvider = new MockAIProvider();
    const ai = new AIService(aiProvider);
    const bvb = new BVBService();
    const pdf = new PDFService();
    const etf = new ETFService(bvb, pdf);

    this.aiProvider = aiProvider;
    this.ai = ai;
    this.bvb = bvb;
    this.pdf = pdf;
    this.etf = etf;
  }
}
