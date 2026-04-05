import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('stages')    stages()    { return this.svc.stages(); }
  @Get('sources')   sources()   { return this.svc.sources(); }
  @Get('source-counts') sourceCounts() { return this.svc.sourceCounts(); }
  @Get('assignees') assignees() { return this.svc.assignees(); }
  @Get('stats')     stats()     { return this.svc.stats(); }
  @Get('followups') allFollowups(@Query() q: any) { return this.svc.allFollowups(q); }

  @Get()   list(@Query() q: any)       { return this.svc.list(q); }
  @Post()  create(@Body() b: any)      { return this.svc.create(b); }

  @Get(':id')
  async show(@Param('id') id: string) {
    const lead = await this.svc.get(Number(id));
    if (!lead) throw new NotFoundException();
    return { lead };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() b: any) { return this.svc.update(Number(id), b); }

  @UseGuards(RolesGuard) @Roles('Admin','Manager')
  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }

  @Get(':id/activities')  activities(@Param('id') id: string)  { return this.svc.activities(Number(id)); }
  @Post(':id/activities') addActivity(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    return this.svc.addActivity(Number(id), u.id, b.type, b.description);
  }

  @Get(':id/followups')  followups(@Param('id') id: string) { return this.svc.followups(Number(id)); }
  @Post(':id/followups') addFollowup(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    return this.svc.addFollowup(Number(id), { ...b, assigned_to: b.assigned_to || u.id });
  }

  @Patch(':id/followups/:fid/done')
  doneFollowup(@Param('fid') fid: string) { return this.svc.doneFollowup(Number(fid)); }
}
