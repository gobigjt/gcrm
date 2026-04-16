import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { AuditService }   from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  // ─── Users ───────────────────────────────────────────────

  async listUsers(ctx?: any) {
    const isSuper = this.isSuperAdmin(ctx);
    const tenantId = isSuper ? null : this.requireTenantId(ctx);
    const res = await this.db.query(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.avatar_url,
             u.zone_id, u.sales_manager_id,
             z.name AS zone_name,
             sm.name AS sales_manager_name,
             r.id AS role_id, r.description AS role_description,
             COUNT(DISTINCT up.permission_id) AS extra_permissions
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN zones z ON z.id = u.zone_id
        LEFT JOIN users sm ON sm.id = u.sales_manager_id
        LEFT JOIN user_permissions up ON up.user_id = u.id
       WHERE LOWER(TRIM(COALESCE(r.name, u.role, ''))) <> 'super admin'
         AND ($1::integer IS NULL OR u.tenant_id = $1)
       GROUP BY u.id, r.id, z.id, sm.id
       ORDER BY u.created_at DESC
    `, [tenantId]);
    return res.rows;
  }

  async getUser(id: number, ctx?: any) {
    const isSuper = this.isSuperAdmin(ctx);
    const tenantId = isSuper ? null : this.requireTenantId(ctx);
    const res = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              u.zone_id, u.sales_manager_id,
              z.name AS zone_name,
              sm.name AS sales_manager_name,
              r.id AS role_id
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         LEFT JOIN zones z ON z.id = u.zone_id
         LEFT JOIN users sm ON sm.id = u.sales_manager_id
        WHERE u.id = $1
          AND ($2::integer IS NULL OR u.tenant_id = $2)`, [id, tenantId],
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    return res.rows[0];
  }

  private async assertZoneExists(zoneId: number | null | undefined) {
    if (zoneId == null) return;
    const z = await this.db.query('SELECT id FROM zones WHERE id=$1', [zoneId]);
    if (!z.rows[0]) throw new BadRequestException('Zone not found');
  }

  private async assertSalesManager(managerId: number, label = 'Sales manager', tenantId?: number | null) {
    const r = await this.db.query(
      `SELECT id, role
         FROM users
        WHERE id=$1
          AND is_active=TRUE
          AND ($2::integer IS NULL OR tenant_id = $2)`,
      [managerId, tenantId ?? null],
    );
    if (!r.rows[0]) throw new BadRequestException(`${label} not found`);
    if (r.rows[0].role !== 'Sales Manager') throw new BadRequestException(`${label} must be an active Sales Manager`);
  }

  async createUser(
    data: {
      name: string;
      email: string;
      password: string;
      role: string;
      zone_id?: number | null;
      sales_manager_id?: number | null;
    },
    actorId?: number,
    actor?: any,
  ) {
    const isSuper = this.isSuperAdmin(actor);
    const tenantId = isSuper ? null : this.requireTenantId(actor);
    const exists = await this.db.query(
      `SELECT id
         FROM users
        WHERE LOWER(email)=LOWER($1)
          AND ($2::integer IS NULL OR tenant_id = $2)`,
      [data.email, tenantId],
    );
    if (exists.rows[0]) throw new ConflictException('Email already registered');
    const hashed = await bcrypt.hash(data.password, 10);
    const roleName = data.role || 'Agent';
    const roleRes = await this.db.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    if (!roleRes.rows[0]) throw new BadRequestException(`Role '${roleName}' not found`);

    const rawZone = data.zone_id as unknown;
    let zoneId: number | null =
      rawZone != null && String(rawZone).trim() !== '' ? Number(rawZone) : null;
    if (zoneId != null && !Number.isFinite(zoneId)) zoneId = null;
    await this.assertZoneExists(zoneId ?? undefined);

    const rawMgr = data.sales_manager_id as unknown;
    let managerId: number | null =
      rawMgr != null && String(rawMgr).trim() !== '' ? Number(rawMgr) : null;
    if (managerId != null && !Number.isFinite(managerId)) managerId = null;
    if (roleName !== 'Sales Executive') managerId = null;
    if (managerId != null) {
      await this.assertSalesManager(managerId, 'Sales manager', tenantId);
    }

    const res = await this.db.query(
      `INSERT INTO users (name,email,password,role,role_id,zone_id,sales_manager_id,tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, (SELECT tenant_id FROM users WHERE id=$9 LIMIT 1)))
       RETURNING id,name,email,role,is_active,created_at,zone_id,sales_manager_id,tenant_id`,
      [data.name, data.email, hashed, roleName, roleRes.rows[0].id, zoneId, managerId, tenantId, actorId ?? null],
    );
    const created = res.rows[0];
    this.audit.log({ user_id: actorId, action: 'create_user', module: 'users', record_id: created.id, details: { name: created.name, email: created.email, role: created.role } });
    return created;
  }

  async updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      role?: string;
      password?: string;
      zone_id?: number | null;
      sales_manager_id?: number | null;
    },
    actorId?: number,
    actor?: any,
  ) {
    const isSuper = this.isSuperAdmin(actor);
    const tenantId = isSuper ? null : this.requireTenantId(actor);
    const cur = await this.db.query(
      'SELECT id, role, sales_manager_id, tenant_id FROM users WHERE id=$1 AND ($2::integer IS NULL OR tenant_id = $2)',
      [id, tenantId],
    );
    if (!cur.rows[0]) throw new NotFoundException('User not found');
    let nextRole = cur.rows[0].role as string;

    const sets: string[] = [];
    const vals: any[]    = [];
    let i = 1;
    let managerClearedByRoleChange = false;
    if (data.name  !== undefined) { sets.push(`name=$${i++}`);  vals.push(data.name); }
    if (data.email !== undefined) { sets.push(`email=$${i++}`); vals.push(data.email); }
    if (data.role  !== undefined) {
      const roleRes = await this.db.query('SELECT id FROM roles WHERE name=$1', [data.role]);
      if (!roleRes.rows[0]) throw new BadRequestException(`Role '${data.role}' not found`);
      sets.push(`role=$${i++}`);  vals.push(data.role);
      sets.push(`role_id=$${i++}`); vals.push(roleRes.rows[0].id);
      nextRole = data.role;
      if (data.role !== 'Sales Executive') {
        sets.push(`sales_manager_id=$${i++}`);
        vals.push(null);
        managerClearedByRoleChange = true;
      }
    }
    if (data.password) {
      sets.push(`password=$${i++}`);
      vals.push(await bcrypt.hash(data.password, 10));
    }
    if (data.zone_id !== undefined) {
      const rawZ = data.zone_id as unknown;
      let zid: number | null =
        rawZ === null || String(rawZ).trim() === '' ? null : Number(rawZ);
      if (zid != null && !Number.isFinite(zid)) zid = null;
      await this.assertZoneExists(zid ?? undefined);
      sets.push(`zone_id=$${i++}`);
      vals.push(zid);
    }
    if (data.sales_manager_id !== undefined && !managerClearedByRoleChange) {
      const rawM = data.sales_manager_id as unknown;
      let mid: number | null =
        rawM === null || String(rawM).trim() === '' ? null : Number(rawM);
      if (mid != null && !Number.isFinite(mid)) mid = null;
      if (nextRole !== 'Sales Executive') {
        sets.push(`sales_manager_id=$${i++}`);
        vals.push(null);
      } else {
        if (mid != null) {
          if (mid === id) throw new BadRequestException('Sales executive cannot report to themselves');
          await this.assertSalesManager(mid, 'Sales manager', tenantId);
        }
        sets.push(`sales_manager_id=$${i++}`);
        vals.push(mid);
      }
    }
    if (!sets.length) return this.getUser(id, actor);
    sets.push('updated_at=NOW()');
    vals.push(id);
    vals.push(tenantId);
    const res = await this.db.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i} AND ($${i + 1}::integer IS NULL OR tenant_id = $${i + 1})
       RETURNING id,name,email,role,is_active,created_at,zone_id,sales_manager_id,tenant_id`,
      vals,
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    this.audit.log({ user_id: actorId, action: 'update_user', module: 'users', record_id: id, details: { fields: Object.keys(data) } });
    return res.rows[0];
  }

  async toggleStatus(id: number, actorId?: number, actor?: any) {
    const isSuper = this.isSuperAdmin(actor);
    const tenantId = isSuper ? null : this.requireTenantId(actor);
    const res = await this.db.query(
      `UPDATE users SET is_active = NOT is_active, updated_at=NOW()
       WHERE id=$1 AND ($2::integer IS NULL OR tenant_id = $2)
       RETURNING id,name,email,role,is_active`, [id, tenantId],
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    this.audit.log({ user_id: actorId, action: res.rows[0].is_active ? 'enable_user' : 'disable_user', module: 'users', record_id: id });
    return res.rows[0];
  }

  // ─── User Permissions ────────────────────────────────────

  async getUserPermissions(userId: number, actor?: any) {
    const isSuper = this.isSuperAdmin(actor);
    const tenantId = isSuper ? null : this.requireTenantId(actor);
    // Role-based permissions
    const rolePerms = await this.db.query(`
      SELECT p.id, p.module, p.action, p.label, TRUE AS from_role
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1
         AND ($2::integer IS NULL OR u.tenant_id = $2)
    `, [userId, tenantId]);

    // User-specific overrides
    const userPerms = await this.db.query(`
      SELECT p.id, p.module, p.action, p.label, FALSE AS from_role
        FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1
    `, [userId]);

    return { role_permissions: rolePerms.rows, user_permissions: userPerms.rows };
  }

  async setUserPermissions(userId: number, permissionIds: number[], actorId?: number, actor?: any) {
    const isSuper = this.isSuperAdmin(actor);
    const tenantId = isSuper ? null : this.requireTenantId(actor);
    const target = await this.db.query(
      'SELECT id FROM users WHERE id=$1 AND ($2::integer IS NULL OR tenant_id = $2)',
      [userId, tenantId],
    );
    if (!target.rows[0]) throw new NotFoundException('User not found');
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM user_permissions WHERE user_id=$1', [userId]);
      if (permissionIds.length > 0) {
        const values = permissionIds.map((_pid, i) => `($1,$${i + 2})`).join(',');
        await client.query(
          `INSERT INTO user_permissions (user_id,permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [userId, ...permissionIds],
        );
      }
    });
    this.audit.log({ user_id: actorId, action: 'set_user_permissions', module: 'users', record_id: userId, details: { count: permissionIds.length } });
    return this.getUserPermissions(userId, actor);
  }

  // ─── Roles ───────────────────────────────────────────────

  async listRoles(ctx?: any) {
    const isSuper = this.isSuperAdmin(ctx);
    const tenantId = isSuper ? null : this.requireTenantId(ctx);
    const res = await this.db.query(`
      SELECT r.id, r.name, r.description, r.is_system, r.created_at,
             COUNT(rp.permission_id) AS permission_count,
             COUNT(DISTINCT u.id)    AS user_count
        FROM roles r
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN users u ON u.role_id = r.id AND ($1::integer IS NULL OR u.tenant_id = $1)
       GROUP BY r.id
       ORDER BY r.id
    `, [tenantId]);
    return res.rows;
  }

  async getRole(id: number, _ctx?: any) {
    const roleRes = await this.db.query('SELECT * FROM roles WHERE id=$1', [id]);
    if (!roleRes.rows[0]) throw new NotFoundException('Role not found');
    const permsRes = await this.db.query(`
      SELECT p.id, p.module, p.action, p.label
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action
    `, [id]);
    return { ...roleRes.rows[0], permissions: permsRes.rows };
  }

  async createRole(data: { name: string; description?: string }, actorId?: number, actor?: any) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only Super Admin can create roles');
    }
    const res = await this.db.query(
      'INSERT INTO roles (name,description) VALUES ($1,$2) RETURNING *',
      [data.name, data.description || null],
    );
    this.audit.log({ user_id: actorId, action: 'create_role', module: 'users', record_id: res.rows[0].id, details: { name: data.name } });
    return res.rows[0];
  }

  async updateRole(id: number, data: { name?: string; description?: string }, actorId?: number, actor?: any) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only Super Admin can update roles');
    }
    const sets: string[] = [];
    const vals: any[]    = [];
    let i = 1;
    if (data.name        !== undefined) { sets.push(`name=$${i++}`);        vals.push(data.name); }
    if (data.description !== undefined) { sets.push(`description=$${i++}`); vals.push(data.description); }
    if (!sets.length) return this.getRole(id, actor);
    vals.push(id);
    const res = await this.db.query(
      `UPDATE roles SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals,
    );
    if (!res.rows[0]) throw new NotFoundException('Role not found');
    this.audit.log({ user_id: actorId, action: 'update_role', module: 'users', record_id: id });
    return res.rows[0];
  }

  async deleteRole(id: number, actorId?: number, actor?: any) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only Super Admin can delete roles');
    }
    const role = await this.db.query('SELECT * FROM roles WHERE id=$1', [id]);
    if (!role.rows[0]) throw new NotFoundException('Role not found');
    if (role.rows[0].is_system) throw new BadRequestException('System roles cannot be deleted');
    const inUse = await this.db.query('SELECT id FROM users WHERE role_id=$1 LIMIT 1', [id]);
    if (inUse.rows[0]) throw new BadRequestException('Role is assigned to users — reassign them first');
    await this.db.query('DELETE FROM roles WHERE id=$1', [id]);
    this.audit.log({ user_id: actorId, action: 'delete_role', module: 'users', record_id: id, details: { name: role.rows[0].name } });
    return { deleted: true };
  }

  async setRolePermissions(roleId: number, permissionIds: number[], actorId?: number, actor?: any) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only Super Admin can edit role permissions');
    }
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
      if (permissionIds.length > 0) {
        const values = permissionIds.map((_pid, i) => `($1,$${i + 2})`).join(',');
        await client.query(
          `INSERT INTO role_permissions (role_id,permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [roleId, ...permissionIds],
        );
      }
    });
    this.audit.log({ user_id: actorId, action: 'set_role_permissions', module: 'users', record_id: roleId, details: { count: permissionIds.length } });
    return this.getRole(roleId, actor);
  }

  // ─── Permissions ─────────────────────────────────────────

  async listPermissions(_ctx?: any) {
    const res = await this.db.query('SELECT id, module, action, label FROM permissions ORDER BY module, action');
    // Group by module
    const grouped: Record<string, any[]> = {};
    for (const row of res.rows) {
      if (!grouped[row.module]) grouped[row.module] = [];
      grouped[row.module].push(row);
    }
    return grouped;
  }

  async listPermissionsFlat(_ctx?: any) {
    const res = await this.db.query('SELECT id, module, action, label FROM permissions ORDER BY module, action');
    return res.rows;
  }

  // ─── Zones (under Users module) ──────────────────────────

  async listZones(_ctx?: any) {
    const res = await this.db.query(
      `SELECT id, name, code, created_at, updated_at FROM zones ORDER BY LOWER(name)`,
    );
    return res.rows;
  }

  async createZone(data: { name: string; code?: string | null }, actorId?: number) {
    const name = (data.name || '').trim();
    if (!name) throw new BadRequestException('Zone name is required');
    const rawCode = data.code != null ? String(data.code).trim() : '';
    const code = rawCode === '' ? null : rawCode;
    try {
      const res = await this.db.query(
        `INSERT INTO zones (name, code) VALUES ($1, $2) RETURNING id, name, code, created_at, updated_at`,
        [name, code],
      );
      this.audit.log({ user_id: actorId, action: 'create_zone', module: 'users', record_id: res.rows[0].id });
      return res.rows[0];
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('Zone code must be unique');
      throw e;
    }
  }

  async updateZone(id: number, data: { name?: string; code?: string | null }, actorId?: number) {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (data.name !== undefined) {
      const name = (data.name || '').trim();
      if (!name) throw new BadRequestException('Zone name is required');
      sets.push(`name=$${i++}`);
      vals.push(name);
    }
    if (data.code !== undefined) {
      const raw = data.code == null ? '' : String(data.code).trim();
      sets.push(`code=$${i++}`);
      vals.push(raw === '' ? null : raw);
    }
    if (!sets.length) {
      const cur = await this.db.query('SELECT * FROM zones WHERE id=$1', [id]);
      if (!cur.rows[0]) throw new NotFoundException('Zone not found');
      return cur.rows[0];
    }
    sets.push('updated_at=NOW()');
    vals.push(id);
    try {
      const res = await this.db.query(
        `UPDATE zones SET ${sets.join(',')} WHERE id=$${i} RETURNING id, name, code, created_at, updated_at`,
        vals,
      );
      if (!res.rows[0]) throw new NotFoundException('Zone not found');
      this.audit.log({ user_id: actorId, action: 'update_zone', module: 'users', record_id: id });
      return res.rows[0];
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('Zone code must be unique');
      throw e;
    }
  }

  async deleteZone(id: number, actorId?: number) {
    const res = await this.db.query('DELETE FROM zones WHERE id=$1 RETURNING id', [id]);
    if (!res.rows[0]) throw new NotFoundException('Zone not found');
    this.audit.log({ user_id: actorId, action: 'delete_zone', module: 'users', record_id: id });
    return { deleted: true };
  }

  /** Active users with role Sales Manager (for assigning to new/edit Sales Executives). */
  async listSalesManagers(ctx?: any) {
    const isSuper = this.isSuperAdmin(ctx);
    const tenantId = isSuper ? null : this.requireTenantId(ctx);
    const res = await this.db.query(
      `SELECT id, name, email FROM users
        WHERE is_active = TRUE
          AND role = 'Sales Manager'
          AND ($1::integer IS NULL OR tenant_id = $1)
       ORDER BY LOWER(name)`,
      [tenantId],
    );
    return res.rows;
  }

  /** Sales executives on this manager’s team vs unassigned (for add/remove UI). */
  async listSalesTeamForManager(managerId: number, ctx?: any) {
    const isSuper = this.isSuperAdmin(ctx);
    const tenantId = isSuper ? null : this.requireTenantId(ctx);
    await this.assertSalesManager(managerId, 'Manager', tenantId);
    const assigned = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.zone_id, z.name AS zone_name
         FROM users u
         LEFT JOIN zones z ON z.id = u.zone_id
        WHERE u.role = 'Sales Executive'
          AND u.sales_manager_id = $1
          AND ($2::integer IS NULL OR u.tenant_id = $2)
        ORDER BY LOWER(u.name)`,
      [managerId, tenantId],
    );
    const available = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.zone_id, z.name AS zone_name
         FROM users u
         LEFT JOIN zones z ON z.id = u.zone_id
        WHERE u.role = 'Sales Executive'
          AND u.is_active = TRUE
          AND u.sales_manager_id IS NULL
          AND u.id <> $1
          AND ($2::integer IS NULL OR u.tenant_id = $2)
        ORDER BY LOWER(u.name)`,
      [managerId, tenantId],
    );
    return { assigned: assigned.rows, available: available.rows };
  }
}
