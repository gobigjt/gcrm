import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService }  from './users.service';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  // ─── Users ───────────────────────────────────────────────
  @Get()
  listUsers(@CurrentUser() u: any) { return this.svc.listUsers(u); }

  @Post()
  createUser(@CurrentUser() u: any, @Body() body: any) { return this.svc.createUser(body, u.id, u); }

  // Static paths must be registered before parameterized routes so `roles` / `permissions`
  // are not captured as `:id` segments.
  // ─── Roles ───────────────────────────────────────────────
  @Get('roles')
  listRoles(@CurrentUser() u: any) { return this.svc.listRoles(u); }

  @Post('roles')
  createRole(@CurrentUser() u: any, @Body() body: any) { return this.svc.createRole(body, u.id, u); }

  @Patch('roles/:id')
  updateRole(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateRole(Number(id), body, u.id, u);
  }

  @Delete('roles/:id')
  deleteRole(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.deleteRole(Number(id), u.id, u); }

  @Get('roles/:id/permissions')
  getRolePermissions(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.getRole(Number(id), u);
  }

  @Put('roles/:id/permissions')
  setRolePermissions(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { permission_ids: number[] }) {
    return this.svc.setRolePermissions(Number(id), body.permission_ids || [], u.id, u);
  }

  // ─── Permissions ─────────────────────────────────────────
  @Get('permissions')
  listPermissions(@CurrentUser() u: any) { return this.svc.listPermissionsFlat(u); }

  @Get('permissions/grouped')
  listPermissionsGrouped(@CurrentUser() u: any) { return this.svc.listPermissions(u); }

  // ─── Zones (must stay before `:id` routes) ─────────────────
  @Get('zones')
  listZones(@CurrentUser() u: any) { return this.svc.listZones(u); }

  @Post('zones')
  createZone(@CurrentUser() u: any, @Body() body: any) { return this.svc.createZone(body, u.id); }

  @Patch('zones/:zoneId')
  updateZone(@CurrentUser() u: any, @Param('zoneId') zoneId: string, @Body() body: any) {
    return this.svc.updateZone(Number(zoneId), body, u.id);
  }

  @Delete('zones/:zoneId')
  deleteZone(@CurrentUser() u: any, @Param('zoneId') zoneId: string) {
    return this.svc.deleteZone(Number(zoneId), u.id);
  }

  @Get('managers/:managerId/sales-team')
  salesTeamForManager(@CurrentUser() u: any, @Param('managerId') managerId: string) {
    return this.svc.listSalesTeamForManager(Number(managerId), u);
  }

  @Get('sales-managers')
  listSalesManagers(@CurrentUser() u: any) { return this.svc.listSalesManagers(u); }

  @Patch(':id')
  updateUser(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateUser(Number(id), body, u.id, u);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.toggleStatus(Number(id), u.id, u); }

  @Get(':id/permissions')
  getUserPermissions(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.getUserPermissions(Number(id), u);
  }

  @Put(':id/permissions')
  setUserPermissions(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { permission_ids: number[] }) {
    return this.svc.setUserPermissions(Number(id), body.permission_ids || [], u.id, u);
  }
}
