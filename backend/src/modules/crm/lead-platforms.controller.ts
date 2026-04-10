import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LeadPlatformsService } from './lead-platforms.service';

@ApiTags('Lead Platforms')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
@Controller('crm/lead-platforms')
export class LeadPlatformsController {
  constructor(private readonly svc: LeadPlatformsService) {}

  @Get('facebook/oauth/config')
  @ApiOperation({ summary: 'Facebook Login SDK config (app id, graph version)' })
  facebookOauthConfig() {
    return this.svc.facebookOAuthConfig();
  }

  @Post('facebook/oauth/list-pages')
  @ApiOperation({
    summary: 'List Facebook Pages for a User access token from Facebook Login (returns page access tokens)',
  })
  listFacebookPagesForOauth(@Body() body: { user_access_token?: string }) {
    return this.svc.listFacebookPagesForUserAccessToken(body?.user_access_token ?? '');
  }

  @Get('facebook/pages')
  @ApiOperation({ summary: 'List connected Facebook Pages' })
  listFacebookPages() {
    return this.svc.listFacebookPages();
  }

  @Post('facebook/pages')
  @ApiOperation({ summary: 'Connect (or update) a Facebook Page for lead ads' })
  upsertFacebookPage(@Body() body: any) {
    return this.svc.upsertFacebookPage({
      page_id: body.page_id,
      page_url: body.page_url,
      page_name: body.page_name,
      page_access_token: body.page_access_token,
      lead_source_id: body.lead_source_id,
    });
  }

  @Delete('facebook/pages/:id')
  @ApiOperation({ summary: 'Disconnect a Facebook Page' })
  deleteFacebookPage(@Param('id') id: string) {
    return this.svc.deleteFacebookPage(Number(id));
  }

  @Post('facebook/pages/:id/sync-leads')
  @ApiOperation({ summary: 'Fetch all lead submissions from Facebook Lead Gen forms and import into CRM' })
  syncFacebookLeads(@Param('id') id: string) {
    return this.svc.syncFacebookPageLeads(Number(id));
  }

  @Post('facebook/pages/:id/import-leads')
  @ApiOperation({ summary: 'Import Facebook leads into CRM (no page_access_token needed)' })
  importFacebookLeads(@Param('id') id: string, @Body() body: any) {
    return this.svc.importFacebookPageLeads(Number(id), {
      form_id: body.form_id,
      leads: body.leads,
    });
  }

  @Get('google-sheets')
  @ApiOperation({ summary: 'List connected Google Sheets lead sources' })
  listGoogleSheets() {
    return this.svc.listGoogleSheets();
  }

  @Post('google-sheets')
  @ApiOperation({ summary: 'Connect (or update) a Google Sheet for lead sync' })
  upsertGoogleSheet(@Body() body: any) {
    return this.svc.upsertGoogleSheet({
      id: body.id,
      sheet_url: body.sheet_url,
      sheet_gid: body.sheet_gid,
      lead_source_id: body.lead_source_id,
      data_start_row: body.data_start_row,
      is_active: body.is_active,
    });
  }

  @Delete('google-sheets/:id')
  @ApiOperation({ summary: 'Disconnect a Google Sheet lead source' })
  deleteGoogleSheet(@Param('id') id: string) {
    return this.svc.deleteGoogleSheet(Number(id));
  }

  @Post('google-sheets/:id/sync-leads')
  @ApiOperation({ summary: 'Import leads from connected Google Sheet into CRM' })
  syncGoogleSheetLeads(@Param('id') id: string) {
    return this.svc.syncGoogleSheetLeads(Number(id));
  }
}

