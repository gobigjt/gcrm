import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';
import { AuditService }    from '../audit/audit.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly db:    DatabaseService,
    private readonly cache: RedisService,
    private readonly audit: AuditService,
  ) {}

  async getCompanySettings() {
    const cached = await this.cache.get('company:settings');
    if (cached) return cached;
    const res = (await this.db.query('SELECT * FROM company_settings LIMIT 1')).rows[0];
    if (res) await this.cache.set('company:settings', res, 600);
    return res;
  }
  async upsertCompanySettings(data: any, actorId?: number) {
    const existing = await this.getCompanySettings();
    let result: any;
    if (existing) {
      const fields = ['company_name','gstin','address','phone','email','logo_url','currency','fiscal_year_start'];
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
      sets.push('updated_at=NOW()');
      vals.push(existing.id);
      result = (await this.db.query(`UPDATE company_settings SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals)).rows[0];
    } else {
      result = (await this.db.query(
        'INSERT INTO company_settings (company_name,gstin,address,phone,email,logo_url,currency,fiscal_year_start) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [data.company_name||'My Company', data.gstin, data.address, data.phone, data.email, data.logo_url, data.currency||'INR', data.fiscal_year_start],
      )).rows[0];
    }
    await this.cache.del('company:settings');
    this.audit.log({ user_id: actorId, action: 'update_company_settings', module: 'settings' });
    return result;
  }

  async listPermissions() {
    return (await this.db.query(
      `SELECT p.id, p.module, p.action, p.label, r.name AS role
         FROM permissions p
         LEFT JOIN role_permissions rp ON rp.permission_id = p.id
         LEFT JOIN roles r ON r.id = rp.role_id
        ORDER BY p.module, p.action, r.name`,
    )).rows;
  }

  // ─── Module Settings ─────────────────────────────────────

  async listModuleSettings() {
    // No Redis cache — access control must reflect DB state immediately.
    return (await this.db.query(
      'SELECT id, module, label, is_enabled, allowed_roles FROM module_settings ORDER BY id',
    )).rows;
  }

  async updateModuleSettings(module: string, data: { is_enabled?: boolean; allowed_roles?: string[] }, actorId?: number) {
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    if (data.is_enabled    !== undefined) { sets.push(`is_enabled=$${i++}`);    vals.push(data.is_enabled); }
    if (data.allowed_roles !== undefined) { sets.push(`allowed_roles=$${i++}`); vals.push(data.allowed_roles); }
    if (!sets.length) return;
    sets.push('updated_at=NOW()');
    vals.push(module);
    const res = await this.db.query(
      `UPDATE module_settings SET ${sets.join(',')} WHERE module=$${i} RETURNING *`, vals,
    );
    this.audit.log({ user_id: actorId, action: 'update_module_settings', module: 'settings', details: { module, ...data } });
    return res.rows[0];
  }

  async getAuditLogs(filters: any) {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if(filters.module)  { conds.push(`module=$${i++}`);  vals.push(filters.module); }
    if(filters.user_id) { conds.push(`user_id=$${i++}`); vals.push(filters.user_id); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT al.*,u.name AS user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ${where} ORDER BY al.created_at DESC LIMIT 500`, vals
    )).rows;
  }

  async getDashboardStats() {
    const cacheKey = 'dashboard:stats';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const [leads, invoices, orders, employees] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM leads WHERE is_converted=FALSE'),
      this.db.query("SELECT COALESCE(SUM(total_amount),0) AS revenue FROM invoices WHERE status='paid'"),
      this.db.query("SELECT COUNT(*) FROM sales_orders WHERE status NOT IN ('delivered','cancelled')"),
      this.db.query('SELECT COUNT(*) FROM employees WHERE is_active=TRUE'),
    ]);
    const stats = {
      open_leads:      Number(leads.rows[0].count),
      revenue:         Number(invoices.rows[0].revenue),
      active_orders:   Number(orders.rows[0].count),
      total_employees: Number(employees.rows[0].count),
    };
    await this.cache.set(cacheKey, stats, 60);
    return stats;
  }
}
