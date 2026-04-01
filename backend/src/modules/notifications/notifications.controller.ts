import { Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }          from '../../common/guards/jwt-auth.guard';
import { CurrentUser }           from '../../common/decorators/current-user.decorator';
import { NotificationsService }  from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: any) { return this.svc.list(u.id); }

  @Get('unread-count')
  unreadCount(@CurrentUser() u: any) { return this.svc.unreadCount(u.id).then(count => ({ count })); }

  @Patch('read-all')
  markAllRead(@CurrentUser() u: any) { return this.svc.markRead(u.id); }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.markRead(u.id, Number(id));
  }

  @Delete('read')
  deleteRead(@CurrentUser() u: any) { return this.svc.deleteRead(u.id); }
}
