import { Module }          from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService }    from './sales.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalesNotificationsService } from './sales-notifications.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SalesController],
  providers: [SalesService, SalesNotificationsService],
})
export class SalesModule {}
