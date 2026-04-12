import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { LeadsService }  from './leads.service';

@ApiTags('CRM')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  private async assertLeadAccess(id: number, u: any) {
    const lead = await this.svc.get(id, u);
    if (!lead) throw new NotFoundException();
  }

  @Get('stages')    stages()    { return this.svc.stages(); }
  @Get('sources')   sources()   { return this.svc.sources(); }
  @Get('source-counts') sourceCounts(@CurrentUser() u: any) { return this.svc.sourceCounts(u); }
  @Get('assignees') assignees() { return this.svc.assignees(); }
  @Get('stats')     stats(@CurrentUser() u: any)     { return this.svc.stats(u); }
  @Get('followups') allFollowups(@Query() q: any, @CurrentUser() u: any) { return this.svc.allFollowups(q, u); }

  // ─── Masters ──────────────────────────────────────────────
  @Get('masters/sources')  listMasterSources()  { return this.svc.masterSources().list(); }
  @Get('masters/segments') listSegments()       { return this.svc.masterSegments().list(); }
  @Get('masters/priorities') listPriorities()   { return this.svc.masterPriorities().list(); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Post('masters/sources')
  createMasterSource(@Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    return this.svc.masterSources().create(b.name.trim());
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('masters/sources/:id')
  updateMasterSource(@Param('id') id: string, @Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    return this.svc.masterSources().update(Number(id), b.name.trim());
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Delete('masters/sources/:id')
  removeMasterSource(@Param('id') id: string) { return this.svc.masterSources().remove(Number(id)); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Post('masters/segments')
  createSegment(@Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    return this.svc.masterSegments().create(b.name.trim());
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('masters/segments/:id')
  updateSegment(@Param('id') id: string, @Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    return this.svc.masterSegments().update(Number(id), b.name.trim());
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Delete('masters/segments/:id')
  removeSegment(@Param('id') id: string) { return this.svc.masterSegments().remove(Number(id)); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Post('masters/priorities')
  createPriority(@Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    const extra = b.color !== undefined ? { color: b.color } : {};
    return this.svc.masterPriorities().create(b.name.trim(), extra);
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('masters/priorities/:id')
  updatePriority(@Param('id') id: string, @Body() b: any) {
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    const extra = b.color !== undefined ? { color: b.color } : {};
    return this.svc.masterPriorities().update(Number(id), b.name.trim(), extra);
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Delete('masters/priorities/:id')
  removePriority(@Param('id') id: string) { return this.svc.masterPriorities().remove(Number(id)); }

  @Get()
  @ApiOperation({ summary: 'List leads (optional pagination: pass page>=1 → { data, total, page, page_size })' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'If set (>=1), response is paginated object' })
  @ApiQuery({ name: 'page_size', required: false, type: Number, description: 'Page size (default 25, max 100)' })
  @ApiQuery({ name: 'created_from', required: false, type: String, description: 'Filter created_at from (YYYY-MM-DD, UTC start of day)' })
  @ApiQuery({ name: 'created_to', required: false, type: String, description: 'Filter created_at through (YYYY-MM-DD, UTC end of day inclusive)' })
  list(@Query() q: any, @CurrentUser() u: any) {
    return this.svc.list(q, u);
  }
  @Post()  create(@Body() b: any, @CurrentUser() u: any) {
    return this.svc.create({ ...b, created_by: u?.id ?? null });
  }

  @Get(':id')
  async show(@Param('id') id: string, @CurrentUser() u: any) {
    const lead = await this.svc.get(Number(id), u);
    if (!lead) throw new NotFoundException();
    return { lead };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.update(leadId, b);
  }

  @UseGuards(RolesGuard) @Roles('Admin','Manager')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: any) {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.remove(leadId);
  }

  @Get(':id/activities')
  async activities(@Param('id') id: string, @CurrentUser() u: any)  {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.activities(leadId);
  }
  @Post(':id/activities')
  async addActivity(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.addActivity(leadId, u.id, b.type, b.description);
  }

  @Get(':id/followups')
  async followups(@Param('id') id: string, @CurrentUser() u: any) {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.followups(leadId);
  }
  @Post(':id/followups')
  async addFollowup(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const leadId = Number(id);
    await this.assertLeadAccess(leadId, u);
    return this.svc.addFollowup(leadId, { ...b, assigned_to: b.assigned_to || u.id });
  }

  @Patch(':id/followups/:fid/done')
  doneFollowup(@Param('fid') fid: string) { return this.svc.doneFollowup(Number(fid)); }
}
