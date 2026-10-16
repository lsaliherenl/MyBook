import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CirculationService } from './circulation.service.js';

/** Every five minutes: READY reservations past their pickup window expire and the copy moves on. */
@Injectable()
export class HoldExpiryJob {
  private readonly logger = new Logger(HoldExpiryJob.name);
  private running = false;

  constructor(private readonly circulation: CirculationService) {}

  @Interval(5 * 60 * 1000)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.circulation.expireHolds();
      if (expired > 0) this.logger.log(`Expired ${expired} uncollected reservation(s)`);
    } catch (error) {
      this.logger.error(`Hold expiry failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
