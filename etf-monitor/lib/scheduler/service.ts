import type { Job } from './types';
import { ConfigService } from '../config/service';
import { BVBService } from '../bvb';
import { ETFService } from '../etf';
import { PDFService } from '../pdf';

export class SchedulerService {
  listJobs(): Job[] {
    const settings = new ConfigService().getSchedulerSettings();
    const [hour, minute] = settings.time.split(':');

    return [
      {
        id: 'daily-etf-monitor',
        name: 'Daily ETF Monitor',
        schedule: `${Number(minute)} ${Number(hour)} * * 1-5`,
        enabled: settings.enabled,
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
