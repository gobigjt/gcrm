import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private normalizeSlug(raw: string): string {
    const cleaned = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    if (!cleaned) {
      throw new BadRequestException('Valid tenant slug is required');
    }
    return cleaned;
  }

  async listTenants(params?: { search?: string; page?: number; limit?: number }) {
    const search = String(params?.search || '').trim();
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params?.limit || 10)));
    const offset = (page - 1) * limit;
    const hasFilters = Boolean(search) || params?.page != null || params?.limit != null;

    const whereParts: string[] = [];
    const whereVals: any[] = [];
    if (search) {
      whereParts.push(`(LOWER(t.name) LIKE LOWER($1) OR LOWER(t.slug) LIKE LOWER($1))`);
      whereVals.push(`%${search}%`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    if (!hasFilters) {
      const res = await this.db.query(
        `SELECT
           t.id,
           t.name,
           t.slug,
           t.is_active,
           t.created_at,
           t.updated_at,
           COUNT(u.id)::int AS users_total,
           COUNT(*) FILTER (WHERE u.is_active = TRUE)::int AS users_active
         FROM tenants t
         LEFT JOIN users u ON u.tenant_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC, t.id DESC`,
      );
      return res.rows;
    }

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM tenants t
       ${whereSql}`,
      whereVals,
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const res = await this.db.query(
      `SELECT
         t.id,
         t.name,
         t.slug,
         t.is_active,
         t.created_at,
         t.updated_at,
         COUNT(u.id)::int AS users_total,
         COUNT(*) FILTER (WHERE u.is_active = TRUE)::int AS users_active
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       ${whereSql}
       GROUP BY t.id
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT $${whereVals.length + 1}
       OFFSET $${whereVals.length + 2}`,
      [...whereVals, limit, offset],
    );
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
    return {
      items: res.rows,
      total,
      page,
      limit,
      total_pages: totalPages,
    };
  }

  async getTenant(id: number) {
    const res = await this.db.query(
      `SELECT
         t.id,
         t.name,
         t.slug,
         t.is_active,
         t.created_at,
         t.updated_at,
         COUNT(u.id)::int AS users_total,
         COUNT(*) FILTER (WHERE u.is_active = TRUE)::int AS users_active
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [id],
    );
    if (!res.rows[0]) throw new NotFoundException('Tenant not found');
    return res.rows[0];
  }

  async createTenant(body: CreateTenantDto, actorId?: number) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('Tenant name is required');
    const slug = this.normalizeSlug(body?.slug || name);
    const isActive = body?.is_active ?? true;

    try {
      const res = await this.db.query(
        `INSERT INTO tenants (name, slug, is_active)
         VALUES ($1, $2, $3)
         RETURNING id, name, slug, is_active, created_at, updated_at`,
        [name, slug, isActive],
      );
      const row = res.rows[0];
      this.audit.log({
        user_id: actorId,
        action: 'create_tenant',
        module: 'tenants',
        record_id: row.id,
        details: { name: row.name, slug: row.slug, is_active: row.is_active },
      });
      return row;
    } catch (e: any) {
      if (String(e?.code) === '23505') {
        throw new ConflictException('Tenant slug already exists');
      }
      throw e;
    }
  }

  async updateTenant(id: number, body: UpdateTenantDto, actorId?: number) {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (body?.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw new BadRequestException('Tenant name cannot be empty');
      sets.push(`name=$${i++}`);
      vals.push(name);
    }
    if (body?.slug !== undefined) {
      sets.push(`slug=$${i++}`);
      vals.push(this.normalizeSlug(body.slug));
    }
    if (body?.is_active !== undefined) {
      sets.push(`is_active=$${i++}`);
      vals.push(Boolean(body.is_active));
    }
    if (!sets.length) {
      return this.getTenant(id);
    }

    sets.push('updated_at=NOW()');
    vals.push(id);

    try {
      const res = await this.db.query(
        `UPDATE tenants
            SET ${sets.join(', ')}
          WHERE id=$${i}
          RETURNING id, name, slug, is_active, created_at, updated_at`,
        vals,
      );
      if (!res.rows[0]) throw new NotFoundException('Tenant not found');
      this.audit.log({
        user_id: actorId,
        action: 'update_tenant',
        module: 'tenants',
        record_id: id,
        details: { fields: Object.keys(body || {}) },
      });
      return res.rows[0];
    } catch (e: any) {
      if (String(e?.code) === '23505') {
        throw new ConflictException('Tenant slug already exists');
      }
      throw e;
    }
  }

  async toggleTenantStatus(id: number, actorId?: number) {
    const res = await this.db.query(
      `UPDATE tenants
          SET is_active = NOT is_active,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, slug, is_active, created_at, updated_at`,
      [id],
    );
    if (!res.rows[0]) throw new NotFoundException('Tenant not found');
    const row = res.rows[0];
    this.audit.log({
      user_id: actorId,
      action: row.is_active ? 'activate_tenant' : 'deactivate_tenant',
      module: 'tenants',
      record_id: id,
      details: { is_active: row.is_active },
    });
    return row;
  }
}
