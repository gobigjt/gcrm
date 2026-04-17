import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Super Admin')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Number(pageRaw);
    const limit = Number(limitRaw);
    const hasPagination = Number.isFinite(page) || Number.isFinite(limit);
    const hasSearch = Boolean(String(search || '').trim());
    if (!hasPagination && !hasSearch) {
      return this.svc.listTenants();
    }
    return this.svc.listTenants({
      search,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 10,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getTenant(Number(id));
  }

  @Post()
  create(@CurrentUser() u: any, @Body() body: CreateTenantDto) {
    return this.svc.createTenant(body, Number(u?.id || 0) || undefined);
  }

  @Patch(':id')
  update(@CurrentUser() u: any, @Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.svc.updateTenant(Number(id), body, Number(u?.id || 0) || undefined);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.toggleTenantStatus(Number(id), Number(u?.id || 0) || undefined);
  }
}
