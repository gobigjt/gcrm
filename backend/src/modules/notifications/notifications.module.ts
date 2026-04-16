import { Module }                    from '@nestjs/common';
import { NotificationsController }   from './notifications.controller';
import { NotificationsService }      from './notifications.service';
import { DatabaseModule }            from '../../database/database.module';
import { FcmPushService } from './fcm-push.service';

@Module({
  imports:     [DatabaseModule],
  controllers: [NotificationsController],
  providers:   [NotificationsService, FcmPushService],
  exports:     [NotificationsService, FcmPushService],
})
export class NotificationsModule {}
