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
  listUsers() { return this.svc.listUsers(); }

  @Post()
  createUser(@CurrentUser() u: any, @Body() body: any) { return this.svc.createUser(body, u.id); }

  @Patch(':id')
  updateUser(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateUser(Number(id), body, u.id);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.toggleStatus(Number(id), u.id); }

  @Get(':id/permissions')
  getUserPermissions(@Param('id') id: string) { return this.svc.getUserPermissions(Number(id)); }

  @Put(':id/permissions')
  setUserPermissions(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { permission_ids: number[] }) {
    return this.svc.setUserPermissions(Number(id), body.permission_ids || [], u.id);
  }

  // ─── Roles ───────────────────────────────────────────────
  @Get('roles')
  listRoles() { return this.svc.listRoles(); }

  @Post('roles')
  createRole(@CurrentUser() u: any, @Body() body: any) { return this.svc.createRole(body, u.id); }

  @Patch('roles/:id')
  updateRole(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateRole(Number(id), body, u.id);
  }

  @Delete('roles/:id')
  deleteRole(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.deleteRole(Number(id), u.id); }

  @Get('roles/:id/permissions')
  getRolePermissions(@Param('id') id: string) { return this.svc.getRole(Number(id)); }

  @Put('roles/:id/permissions')
  setRolePermissions(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { permission_ids: number[] }) {
    return this.svc.setRolePermissions(Number(id), body.permission_ids || [], u.id);
  }

  // ─── Permissions ─────────────────────────────────────────
  @Get('permissions')
  listPermissions() { return this.svc.listPermissionsFlat(); }

  @Get('permissions/grouped')
  listPermissionsGrouped() { return this.svc.listPermissions(); }
}
