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

  @Get('templates')              listTemplates(@CurrentUser() u: any)                  { return this.svc.listTemplates(u); }
  @Post('templates')             createTemplate(@CurrentUser() u: any, @Body() b: any)   { return this.svc.createTemplate(b, u); }
  @Patch('templates/:id')        updateTemplate(@CurrentUser() u: any, @Param('id') id: string, @Body() b: any) { return this.svc.updateTemplate(Number(id), b, u); }
  @UseGuards(RolesGuard) @Roles('Admin','Manager')
  @Delete('templates/:id')       deleteTemplate(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.deleteTemplate(Number(id), u); }

  @Get('logs')                   listLogs(@CurrentUser() u: any, @Query() q: any) { return this.svc.listLogs(q, u); }
  @Get('whatsapp/inbox')         whatsappInbox(@CurrentUser() u: any) { return this.svc.listWhatsAppInbox(u); }
  @Post('logs')                  createLog(@Body() b: any, @CurrentUser() u: any) { return this.svc.createLog({...b, sent_by: u.id}, u); }
}
