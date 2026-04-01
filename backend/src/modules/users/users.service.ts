import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { AuditService }   from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  // ─── Users ───────────────────────────────────────────────

  async listUsers() {
    const res = await this.db.query(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
             r.id AS role_id, r.description AS role_description,
             COUNT(DISTINCT up.permission_id) AS extra_permissions
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN user_permissions up ON up.user_id = u.id
       GROUP BY u.id, r.id
       ORDER BY u.created_at DESC
    `);
    return res.rows;
  }

  async getUser(id: number) {
    const res = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              r.id AS role_id
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`, [id],
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    return res.rows[0];
  }

  async createUser(data: { name: string; email: string; password: string; role: string }, actorId?: number) {
    const exists = await this.db.query('SELECT id FROM users WHERE email=$1', [data.email]);
    if (exists.rows[0]) throw new ConflictException('Email already registered');
    const hashed = await bcrypt.hash(data.password, 10);
    const roleName = data.role || 'Agent';
    const roleRes = await this.db.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    if (!roleRes.rows[0]) throw new BadRequestException(`Role '${roleName}' not found`);
    const res = await this.db.query(
      `INSERT INTO users (name,email,password,role,role_id) VALUES ($1,$2,$3,$4,$5)
       RETURNING id,name,email,role,is_active,created_at`,
      [data.name, data.email, hashed, roleName, roleRes.rows[0].id],
    );
    const created = res.rows[0];
    this.audit.log({ user_id: actorId, action: 'create_user', module: 'users', record_id: created.id, details: { name: created.name, email: created.email, role: created.role } });
    return created;
  }

  async updateUser(id: number, data: { name?: string; email?: string; role?: string; password?: string }, actorId?: number) {
    const sets: string[] = [];
    const vals: any[]    = [];
    let i = 1;
    if (data.name  !== undefined) { sets.push(`name=$${i++}`);  vals.push(data.name); }
    if (data.email !== undefined) { sets.push(`email=$${i++}`); vals.push(data.email); }
    if (data.role  !== undefined) {
      const roleRes = await this.db.query('SELECT id FROM roles WHERE name=$1', [data.role]);
      if (!roleRes.rows[0]) throw new BadRequestException(`Role '${data.role}' not found`);
      sets.push(`role=$${i++}`);  vals.push(data.role);
      sets.push(`role_id=$${i++}`); vals.push(roleRes.rows[0].id);
    }
    if (data.password) {
      sets.push(`password=$${i++}`);
      vals.push(await bcrypt.hash(data.password, 10));
    }
    if (!sets.length) return this.getUser(id);
    sets.push('updated_at=NOW()');
    vals.push(id);
    const res = await this.db.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id,name,email,role,is_active,created_at`,
      vals,
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    this.audit.log({ user_id: actorId, action: 'update_user', module: 'users', record_id: id, details: { fields: Object.keys(data) } });
    return res.rows[0];
  }

  async toggleStatus(id: number, actorId?: number) {
    const res = await this.db.query(
      `UPDATE users SET is_active = NOT is_active, updated_at=NOW()
       WHERE id=$1 RETURNING id,name,email,role,is_active`, [id],
    );
    if (!res.rows[0]) throw new NotFoundException('User not found');
    this.audit.log({ user_id: actorId, action: res.rows[0].is_active ? 'enable_user' : 'disable_user', module: 'users', record_id: id });
    return res.rows[0];
  }

  // ─── User Permissions ────────────────────────────────────

  async getUserPermissions(userId: number) {
    // Role-based permissions
    const rolePerms = await this.db.query(`
      SELECT p.id, p.module, p.action, p.label, TRUE AS from_role
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1
    `, [userId]);

    // User-specific overrides
    const userPerms = await this.db.query(`
      SELECT p.id, p.module, p.action, p.label, FALSE AS from_role
        FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1
    `, [userId]);

    return { role_permissions: rolePerms.rows, user_permissions: userPerms.rows };
  }

  async setUserPermissions(userId: number, permissionIds: number[], actorId?: number) {
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
    return this.getUserPermissions(userId);
  }

  // ─── Roles ───────────────────────────────────────────────

  async listRoles() {
    const res = await this.db.query(`
      SELECT r.id, r.name, r.description, r.is_system, r.created_at,
             COUNT(rp.permission_id) AS permission_count,
             COUNT(DISTINCT u.id)    AS user_count
        FROM roles r
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN users u ON u.role_id = r.id
       GROUP BY r.id
       ORDER BY r.id
    `);
    return res.rows;
  }

  async getRole(id: number) {
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

  async createRole(data: { name: string; description?: string }, actorId?: number) {
    const res = await this.db.query(
      'INSERT INTO roles (name,description) VALUES ($1,$2) RETURNING *',
      [data.name, data.description || null],
    );
    this.audit.log({ user_id: actorId, action: 'create_role', module: 'users', record_id: res.rows[0].id, details: { name: data.name } });
    return res.rows[0];
  }

  async updateRole(id: number, data: { name?: string; description?: string }, actorId?: number) {
    const sets: string[] = [];
    const vals: any[]    = [];
    let i = 1;
    if (data.name        !== undefined) { sets.push(`name=$${i++}`);        vals.push(data.name); }
    if (data.description !== undefined) { sets.push(`description=$${i++}`); vals.push(data.description); }
    if (!sets.length) return this.getRole(id);
    vals.push(id);
    const res = await this.db.query(
      `UPDATE roles SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals,
    );
    if (!res.rows[0]) throw new NotFoundException('Role not found');
    this.audit.log({ user_id: actorId, action: 'update_role', module: 'users', record_id: id });
    return res.rows[0];
  }

  async deleteRole(id: number, actorId?: number) {
    const role = await this.db.query('SELECT * FROM roles WHERE id=$1', [id]);
    if (!role.rows[0]) throw new NotFoundException('Role not found');
    if (role.rows[0].is_system) throw new BadRequestException('System roles cannot be deleted');
    const inUse = await this.db.query('SELECT id FROM users WHERE role_id=$1 LIMIT 1', [id]);
    if (inUse.rows[0]) throw new BadRequestException('Role is assigned to users — reassign them first');
    await this.db.query('DELETE FROM roles WHERE id=$1', [id]);
    this.audit.log({ user_id: actorId, action: 'delete_role', module: 'users', record_id: id, details: { name: role.rows[0].name } });
    return { deleted: true };
  }

  async setRolePermissions(roleId: number, permissionIds: number[], actorId?: number) {
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
    return this.getRole(roleId);
  }

  // ─── Permissions ─────────────────────────────────────────

  async listPermissions() {
    const res = await this.db.query('SELECT id, module, action, label FROM permissions ORDER BY module, action');
    // Group by module
    const grouped: Record<string, any[]> = {};
    for (const row of res.rows) {
      if (!grouped[row.module]) grouped[row.module] = [];
      grouped[row.module].push(row);
    }
    return grouped;
  }

  async listPermissionsFlat() {
    const res = await this.db.query('SELECT id, module, action, label FROM permissions ORDER BY module, action');
    return res.rows;
  }
}
