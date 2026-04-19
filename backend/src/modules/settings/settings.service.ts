import { ForbiddenException, Injectable } from '@nestjs/common';
import { basename, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';
import { AuditService }    from '../audit/audit.service';
import { ObjectStorageService } from '../../common/services/object-storage.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly db:    DatabaseService,
    private readonly cache: RedisService,
    private readonly audit: AuditService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  private isSuperAdmin(ctx?: { role?: unknown }): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: { tenant_id?: unknown; role?: unknown }): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  async getCompanySettings(ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const cacheKey = `company:settings:${tenantId || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const res = (await this.db.query(
      'SELECT * FROM company_settings WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY id LIMIT 1',
      [tenantId],
    )).rows[0];
    if (res) await this.cache.set(cacheKey, res, 600);
    return res;
  }
  async upsertCompanySettings(data: any, actorId?: number, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const existing = await this.getCompanySettings(ctx);
    let result: any;
    if (existing) {
      const fields = ['company_name','gstin','address','phone','email','logo_url','invoice_logo_url','favicon_url','currency','fiscal_year_start','invoice_tagline','payment_terms','invoice_bank_details','invoice_footer_content','bank_name','bank_branch','bank_account_number','bank_ifsc'];
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
      sets.push('updated_at=NOW()');
      vals.push(existing.id);
      vals.push(tenantId);
      result = (await this.db.query(
        `UPDATE company_settings SET ${sets.join(',')} WHERE id=$${i} AND ($${i + 1}::integer = 0 OR tenant_id = $${i + 1}) RETURNING *`,
        vals,
      )).rows[0];
    } else {
      result = (await this.db.query(
        'INSERT INTO company_settings (company_name,gstin,address,phone,email,logo_url,invoice_logo_url,favicon_url,currency,fiscal_year_start,invoice_tagline,payment_terms,invoice_bank_details,invoice_footer_content,bank_name,bank_branch,bank_account_number,bank_ifsc,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *',
        [data.company_name||'My Company', data.gstin, data.address, data.phone, data.email, data.logo_url, data.invoice_logo_url, data.favicon_url, data.currency||'INR', data.fiscal_year_start, data.invoice_tagline, data.payment_terms, data.invoice_bank_details, data.invoice_footer_content, data.bank_name, data.bank_branch, data.bank_account_number, data.bank_ifsc, tenantId || null],
      )).rows[0];
    }
    await this.cache.del(`company:settings:${tenantId || 'all'}`);
    this.audit.log({ user_id: actorId, action: 'update_company_settings', module: 'settings' });
    return result;
  }

  /** Save uploaded logo file path and remove previous file under /uploads/company/. */
  async setCompanyLogoFromUpload(filename: string, actorId?: number, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    await this.cache.del(`company:settings:${tenantId || 'all'}`);
    const prev = (await this.db.query(
      'SELECT logo_url FROM company_settings WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY id LIMIT 1',
      [tenantId],
    )).rows[0]?.logo_url as string | undefined;
    if (prev && prev.startsWith('/uploads/company/')) {
      const fp = join(process.cwd(), 'uploads', 'company', basename(prev));
      try {
        if (existsSync(fp)) unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    const rel = `/uploads/company/${filename}`;
    return this.upsertCompanySettings({ logo_url: rel }, actorId, ctx);
  }

  /** Save uploaded favicon file path and remove previous file under /uploads/company/. */
  async setCompanyFaviconFromUpload(filename: string, actorId?: number, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    await this.cache.del(`company:settings:${tenantId || 'all'}`);
    const prev = (await this.db.query(
      'SELECT favicon_url FROM company_settings WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY id LIMIT 1',
      [tenantId],
    )).rows[0]?.favicon_url as string | undefined;
    if (prev && prev.startsWith('/uploads/company/')) {
      const fp = join(process.cwd(), 'uploads', 'company', basename(prev));
      try {
        if (existsSync(fp)) unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    const rel = `/uploads/company/${filename}`;
    return this.upsertCompanySettings({ favicon_url: rel }, actorId, ctx);
  }

  /** Save uploaded invoice logo file path and remove previous file under /uploads/company/. */
  async setInvoiceLogoFromUpload(file: Express.Multer.File, actorId?: number, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    await this.cache.del(`company:settings:${tenantId || 'all'}`);
    const prev = (await this.db.query(
      'SELECT invoice_logo_url FROM company_settings WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY id LIMIT 1',
      [tenantId],
    )).rows[0]?.invoice_logo_url as string | undefined;
    if (prev && /^https?:\/\//i.test(prev)) {
      try {
        await this.objectStorage.deleteByPublicUrl(prev);
      } catch {
        /* ignore */
      }
    } else if (prev && prev.startsWith('/uploads/company/')) {
      const fp = join(process.cwd(), 'uploads', 'company', basename(prev));
      try {
        if (existsSync(fp)) unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    const uploaded = await this.objectStorage.uploadPublicImage(file, 'company/invoice-logos');
    return this.upsertCompanySettings({ invoice_logo_url: uploaded.url }, actorId, ctx);
  }

  async listPermissions(_ctx?: { tenant_id?: unknown; role?: unknown }) {
    return (await this.db.query(
      `SELECT p.id, p.module, p.action, p.label, r.name AS role
         FROM permissions p
         LEFT JOIN role_permissions rp ON rp.permission_id = p.id
         LEFT JOIN roles r ON r.id = rp.role_id
        ORDER BY p.module, p.action, r.name`,
    )).rows;
  }

  // ─── Module Settings ─────────────────────────────────────

  async listModuleSettings(ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    // No Redis cache — access control must reflect DB state immediately.
    return (await this.db.query(
      'SELECT id, module, label, is_enabled, allowed_roles FROM module_settings WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY id',
      [tenantId],
    )).rows;
  }

  async updateModuleSettings(module: string, data: { is_enabled?: boolean; allowed_roles?: string[] }, actorId?: number, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    if (data.is_enabled    !== undefined) { sets.push(`is_enabled=$${i++}`);    vals.push(data.is_enabled); }
    if (data.allowed_roles !== undefined) { sets.push(`allowed_roles=$${i++}`); vals.push(data.allowed_roles); }
    if (!sets.length) return;
    sets.push('updated_at=NOW()');
    vals.push(module, tenantId);
    const res = await this.db.query(
      `UPDATE module_settings SET ${sets.join(',')} WHERE module=$${i} AND ($${i + 1}::integer = 0 OR tenant_id = $${i + 1}) RETURNING *`, vals,
    );
    this.audit.log({ user_id: actorId, action: 'update_module_settings', module: 'settings', details: { module, ...data } });
    return res.rows[0];
  }

  async getAuditLogs(filters: any, ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if (tenantId > 0) {
      conds.push(`u.tenant_id=$${i++}`);
      vals.push(tenantId);
    }
    if(filters.module)  { conds.push(`module=$${i++}`);  vals.push(filters.module); }
    if(filters.user_id) { conds.push(`user_id=$${i++}`); vals.push(filters.user_id); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT al.*,u.name AS user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ${where} ORDER BY al.created_at DESC LIMIT 500`, vals
    )).rows;
  }

  async getDashboardStats(ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const cacheKey = `dashboard:stats:${tenantId || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const [leads, invoices, orders, employees, openNew7d, overdueInv, usersActive] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM leads WHERE is_converted=FALSE AND ($1::integer = 0 OR tenant_id = $1)', [tenantId]),
      this.db.query("SELECT COALESCE(SUM(total_amount),0) AS revenue FROM invoices WHERE status='paid' AND ($1::integer = 0 OR tenant_id = $1)", [tenantId]),
      this.db.query("SELECT COUNT(*) FROM sales_orders WHERE status NOT IN ('delivered','cancelled') AND ($1::integer = 0 OR tenant_id = $1)", [tenantId]),
      this.db.query('SELECT COUNT(*) FROM employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.is_active=TRUE AND ($1::integer = 0 OR u.tenant_id = $1)', [tenantId]),
      this.db.query(
        `SELECT COUNT(*) FROM leads WHERE is_converted=FALSE AND created_at >= NOW() - INTERVAL '7 days' AND ($1::integer = 0 OR tenant_id = $1)`,
        [tenantId],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM invoices WHERE status <> 'paid' AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND ($1::integer = 0 OR tenant_id = $1)`,
        [tenantId],
      ),
      this.db.query('SELECT COUNT(*) FROM users WHERE is_active=TRUE AND ($1::integer = 0 OR tenant_id = $1)', [tenantId]),
    ]);
    const stats = {
      open_leads:          Number(leads.rows[0].count),
      revenue:             Number(invoices.rows[0].revenue),
      active_orders:       Number(orders.rows[0].count),
      total_employees:     Number(employees.rows[0].count),
      open_leads_new_7d:   Number(openNew7d.rows[0].count),
      overdue_invoices:    Number(overdueInv.rows[0].count),
      active_users:        Number(usersActive.rows[0].count),
    };
    await this.cache.set(cacheKey, stats, 60);
    return stats;
  }

  async getDashboardCharts(ctx?: { tenant_id?: unknown; role?: unknown }) {
    const tenantId = this.requireTenantId(ctx);
    const cacheKey = `dashboard:charts:${tenantId || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const curFYStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);
    const curFYEnd   = new Date(curFYStart.getFullYear() + 1, 3, 1);
    const prevFYStart = new Date(curFYStart.getFullYear() - 1, 3, 1);
    const prevFYEnd   = curFYStart;
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const [curSales, prevSales, clientSales, recentBuyers, recentInvoices, lowStock, salesStats] =
      await Promise.all([
        this.db.query(
          `SELECT EXTRACT(MONTH FROM invoice_date)::int AS m, EXTRACT(YEAR FROM invoice_date)::int AS y,
                  COALESCE(SUM(total_amount),0) AS amount
           FROM invoices WHERE invoice_date >= $1 AND invoice_date < $2 AND ($3::integer = 0 OR tenant_id = $3) GROUP BY m, y`,
          [fmtDate(curFYStart), fmtDate(curFYEnd), tenantId],
        ),
        this.db.query(
          `SELECT EXTRACT(MONTH FROM invoice_date)::int AS m, EXTRACT(YEAR FROM invoice_date)::int AS y,
                  COALESCE(SUM(total_amount),0) AS amount
           FROM invoices WHERE invoice_date >= $1 AND invoice_date < $2 AND ($3::integer = 0 OR tenant_id = $3) GROUP BY m, y`,
          [fmtDate(prevFYStart), fmtDate(prevFYEnd), tenantId],
        ),
        this.db.query(
          `WITH top_clients AS (
             SELECT customer_id FROM invoices
             WHERE invoice_date >= $1 AND invoice_date < $2
               AND ($3::integer = 0 OR tenant_id = $3)
             GROUP BY customer_id ORDER BY SUM(total_amount) DESC LIMIT 8
           )
           SELECT c.name AS customer_name,
                  EXTRACT(MONTH FROM i.invoice_date)::int AS m,
                  EXTRACT(YEAR FROM i.invoice_date)::int AS y,
                  COALESCE(SUM(i.total_amount),0) AS amount
           FROM invoices i
           JOIN customers c ON c.id = i.customer_id
           WHERE i.customer_id IN (SELECT customer_id FROM top_clients)
             AND i.invoice_date >= $1 AND i.invoice_date < $2
             AND ($3::integer = 0 OR i.tenant_id = $3)
           GROUP BY c.name, m, y`,
          [fmtDate(curFYStart), fmtDate(curFYEnd), tenantId],
        ),
        this.db.query(
          `SELECT c.name, COALESCE(SUM(i.total_amount),0) AS total_spent,
                  COUNT(i.id) AS invoice_count, MAX(i.invoice_date) AS last_purchase
           FROM customers c JOIN invoices i ON i.customer_id = c.id
           WHERE ($1::integer = 0 OR i.tenant_id = $1)
           GROUP BY c.id, c.name ORDER BY total_spent DESC LIMIT 10`,
          [tenantId],
        ),
        this.db.query(
          `SELECT i.invoice_number, c.name AS customer_name,
                  i.total_amount, i.status, i.invoice_date,
                  i.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) AS balance
           FROM invoices i JOIN customers c ON c.id = i.customer_id
           WHERE ($1::integer = 0 OR i.tenant_id = $1)
           ORDER BY i.created_at DESC LIMIT 6`,
          [tenantId],
        ),
        this.db.query(
          `SELECT p.name, p.sku, p.low_stock_alert,
                  COALESCE(SUM(s.quantity),0) AS stock
           FROM products p LEFT JOIN stock s ON s.product_id = p.id
           WHERE p.is_active = TRUE
           GROUP BY p.id, p.name, p.sku, p.low_stock_alert
           HAVING COALESCE(SUM(s.quantity),0) <= GREATEST(p.low_stock_alert, 5)
           ORDER BY COALESCE(SUM(s.quantity),0) ASC LIMIT 8`,
        ),
        this.db.query(
          `SELECT COUNT(*) AS total_invoices,
                  COALESCE(SUM(total_amount),0) AS total_sales,
                  COALESCE(SUM(CASE WHEN status='paid'    THEN total_amount ELSE 0 END),0) AS paid_amount,
                  COALESCE(SUM(CASE WHEN status='unpaid'  THEN total_amount ELSE 0 END),0) AS unpaid_amount,
                  COALESCE(SUM(CASE WHEN status='partial' THEN total_amount ELSE 0 END),0) AS partial_amount,
                  COUNT(DISTINCT customer_id) AS unique_customers
           FROM invoices
           WHERE ($1::integer = 0 OR tenant_id = $1)`,
          [tenantId],
        ),
      ]);

    const fyMonths    = [4,5,6,7,8,9,10,11,12,1,2,3];
    const monthLabels = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

    const buildMonthArray = (rows: any[], fyStart: Date) => {
      const map: Record<string, number> = {};
      rows.forEach((r: any) => { map[`${r.y}-${r.m}`] = Number(r.amount); });
      return fyMonths.map((m, idx) => {
        const y = m >= 4 ? fyStart.getFullYear() : fyStart.getFullYear() + 1;
        return { month: monthLabels[idx], amount: map[`${y}-${m}`] || 0 };
      });
    };

    const curArr  = buildMonthArray(curSales.rows,  curFYStart);
    const prevArr = buildMonthArray(prevSales.rows, prevFYStart);

    const monthlyComparison = monthLabels.map((m, i) => ({
      month: m,
      current: curArr[i].amount,
      prev:    prevArr[i].amount,
    }));

    const clientMap: Record<string, Record<string, number>> = {};
    clientSales.rows.forEach((r: any) => {
      if (!clientMap[r.customer_name]) clientMap[r.customer_name] = {};
      const mLabel = monthLabels[fyMonths.indexOf(Number(r.m))];
      clientMap[r.customer_name][mLabel] = Number(r.amount);
    });
    const clientMonthly = Object.entries(clientMap).map(([name, months]) => ({
      customer: name,
      months: monthLabels.map(m => months[m] || 0),
      total: monthLabels.reduce((s, m) => s + (months[m] || 0), 0),
    })).sort((a, b) => b.total - a.total);

    const fyLabel = (s: Date) =>
      `FY ${s.getFullYear()}-${String(s.getFullYear() + 1).slice(-2)}`;

    const result = {
      fy_current:         fyLabel(curFYStart),
      fy_prev:            fyLabel(prevFYStart),
      month_labels:       monthLabels,
      monthly_comparison: monthlyComparison,
      client_monthly:     clientMonthly,
      recent_buyers:      recentBuyers.rows.map((r: any) => ({
        name:          r.name,
        total_spent:   Number(r.total_spent),
        invoice_count: Number(r.invoice_count),
        last_purchase: r.last_purchase,
      })),
      recent_invoices: recentInvoices.rows,
      low_stock_items: lowStock.rows.map((r: any) => ({
        name:            r.name,
        sku:             r.sku,
        stock:           Number(r.stock),
        low_stock_alert: Number(r.low_stock_alert),
      })),
      sales_stats: {
        total_invoices:   Number(salesStats.rows[0]?.total_invoices   || 0),
        total_sales:      Number(salesStats.rows[0]?.total_sales      || 0),
        paid_amount:      Number(salesStats.rows[0]?.paid_amount      || 0),
        unpaid_amount:    Number(salesStats.rows[0]?.unpaid_amount    || 0),
        partial_amount:   Number(salesStats.rows[0]?.partial_amount   || 0),
        unique_customers: Number(salesStats.rows[0]?.unique_customers || 0),
      },
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /** Real aggregates for Super Admin platform screens (single-tenant DB today). */
  async getPlatformSummary() {
    const [users, leads, unpaidInv, overdueFu, products, warehouses] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM users WHERE is_active=TRUE'),
      this.db.query('SELECT COUNT(*) FROM leads'),
      this.db.query("SELECT COUNT(*) FROM invoices WHERE status <> 'paid'"),
      this.db.query(
        `SELECT COUNT(*) FROM lead_followups WHERE is_done=FALSE AND due_date::date < CURRENT_DATE`,
      ),
      this.db.query('SELECT COUNT(*) FROM products WHERE is_active=TRUE'),
      this.db.query('SELECT COUNT(*) FROM warehouses WHERE is_active=TRUE'),
    ]);
    return {
      active_users:       Number(users.rows[0].count),
      leads_total:        Number(leads.rows[0].count),
      unpaid_invoices:    Number(unpaidInv.rows[0].count),
      overdue_followups:  Number(overdueFu.rows[0].count),
      active_products:    Number(products.rows[0].count),
      warehouses:         Number(warehouses.rows[0].count),
    };
  }
}
