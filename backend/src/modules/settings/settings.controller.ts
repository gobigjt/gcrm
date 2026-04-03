import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard';
import { RolesGuard }      from '../../common/guards/roles.guard';
import { Roles }           from '../../common/decorators/roles.decorator';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('company')   getSettings()     { return this.svc.getCompanySettings(); }
  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('company') updateSettings(@CurrentUser() u: any, @Body() b: any) { return this.svc.upsertCompanySettings(b, u.id); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Get('permissions')   listPermissions() { return this.svc.listPermissions(); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Get('audit-logs')    getAuditLogs(@Query() q: any) { return this.svc.getAuditLogs(q); }

  @Get('modules')
  listModules() { return this.svc.listModuleSettings(); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('modules/:module')
  updateModule(@CurrentUser() u: any, @Param('module') module: string, @Body() body: any) {
    return this.svc.updateModuleSettings(module, body, u.id);
  }

  @Get('dashboard')     getDashboardStats() { return this.svc.getDashboardStats(); }

  @UseGuards(RolesGuard) @Roles('Super Admin')
  @Get('platform/summary')
  platformSummary() {
    return this.svc.getPlatformSummary();
  }
}
