import type { Job } from './types';
import { BVBService } from '../bvb';
import { ETFService } from '../etf';
import { PDFService } from '../pdf';

export class SchedulerService {
  listJobs(): Job[] {
    return [
      {
        id: 'daily-etf-monitor',
        name: 'Daily ETF Monitor',
        schedule: '0 19 * * 1-5',
        enabled: true,
      },
    ];
  }

  async runJob(jobId: string): Promise<void> {
    switch (jobId) {
      case 'daily-etf-monitor': {
        const bvbService = new BVBService();
        const pdfService = new PDFService();
        const etfService = new ETFService(bvbService, pdfService);
        await etfService.synchronize();
        return;
      }
      default:
        throw new Error('Unknown job');
    }
  }
}
