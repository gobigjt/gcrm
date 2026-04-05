import { Module }               from '@nestjs/common';
import { LeadsController }      from './leads.controller';
import { LeadsService }         from './leads.service';
import { LeadCaptureController} from './lead-capture.controller';
import { LeadPlatformsController } from './lead-platforms.controller';
import { LeadPlatformsWebhookController } from './lead-platforms-webhook.controller';
import { LeadPlatformsService }    from './lead-platforms.service';
import { DatabaseModule }       from '../../database/database.module';
import { NotificationsModule }  from '../notifications/notifications.module';

@Module({
  imports:     [DatabaseModule, NotificationsModule],
  controllers: [LeadsController, LeadCaptureController, LeadPlatformsController, LeadPlatformsWebhookController],
  providers:   [LeadsService, LeadPlatformsService],
})
export class CrmModule {}
