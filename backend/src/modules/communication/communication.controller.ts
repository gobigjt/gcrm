import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }         from '../../common/guards/jwt-auth.guard';
import { RolesGuard }           from '../../common/guards/roles.guard';
import { Roles }                from '../../common/decorators/roles.decorator';
import { CurrentUser }          from '../../common/decorators/current-user.decorator';
import { CommunicationService } from './communication.service';

@ApiTags('Communication')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly svc: CommunicationService) {}

  @Get('templates')              listTemplates()                  { return this.svc.listTemplates(); }
  @Post('templates')             createTemplate(@Body() b: any)   { return this.svc.createTemplate(b); }
  @Patch('templates/:id')        updateTemplate(@Param('id') id: string, @Body() b: any) { return this.svc.updateTemplate(Number(id), b); }
  @UseGuards(RolesGuard) @Roles('Admin','Manager')
  @Delete('templates/:id')       deleteTemplate(@Param('id') id: string) { return this.svc.deleteTemplate(Number(id)); }

  @Get('logs')                   listLogs(@Query() q: any) { return this.svc.listLogs(q); }
  @Get('whatsapp/inbox')         whatsappInbox() { return this.svc.listWhatsAppInbox(); }
  @Post('logs')                  createLog(@Body() b: any, @CurrentUser() u: any) { return this.svc.createLog({...b, sent_by: u.id}); }
}
