import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

  @Post('push-token')
  registerPushToken(
    @CurrentUser() u: any,
    @Body() body: { token?: string; platform?: string },
  ) {
    return this.svc.registerPushToken({
      userId: Number(u.id),
      token: String(body?.token || ''),
      platform: body?.platform,
    });
  }

  @Delete('push-token')
  unregisterPushToken(
    @CurrentUser() u: any,
    @Body() body?: { token?: string },
  ) {
    return this.svc.unregisterPushToken({
      userId: Number(u.id),
      token: body?.token,
    });
  }

  @Post('test-push')
  testPush(
    @CurrentUser() u: any,
    @Body() body?: {
      user_id?: number;
      title?: string;
      body?: string;
    },
  ) {
    return this.svc.testPush({
      actorUserId: Number(u.id),
      targetUserId: body?.user_id,
      title: body?.title,
      body: body?.body,
    });
  }
}
