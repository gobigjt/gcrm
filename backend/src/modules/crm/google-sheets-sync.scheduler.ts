import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadPlatformsService } from './lead-platforms.service';

@Injectable()
export class GoogleSheetsSyncScheduler {
  private readonly log = new Logger(GoogleSheetsSyncScheduler.name);

  constructor(private readonly leadPlatforms: LeadPlatformsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleGoogleSheetsSync() {
    if (process.env.GOOGLE_SHEETS_SYNC_DISABLED === '1' || process.env.GOOGLE_SHEETS_SYNC_DISABLED === 'true') {
      return;
    }
    this.log.debug('Starting scheduled Google Sheets lead sync');
    await this.leadPlatforms.syncAllActiveGoogleSheets();
  }
}
