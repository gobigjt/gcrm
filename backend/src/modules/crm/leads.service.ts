import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  private async invalidateDashboardCache() {
    await this.cache.del('dashboard:stats');
  }

  /** Absolute URL if `WEB_APP_ORIGIN` is set (e.g. https://app.example.com); else path-only for same-origin clients. */
  private crmLeadWebLink(leadId: number): string {
    const path = `/crm?lead=${leadId}`;
    const base = (process.env.WEB_APP_ORIGIN || '').trim().replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }

  private async notifyCrmLead(userId: number, lead: { id: number; name: string; company?: string | null }, title: string, body?: string | null) {
    if (!userId) return;
    try {
      await this.notifications.create({
        user_id: userId,
        title,
        body: body ?? (lead.company ? String(lead.company) : 'Open to view details'),
        type: 'info',
        module: 'crm',
        link: this.crmLeadWebLink(lead.id),
      });
    } catch {
      /* notification failure must not break CRM */
    }
  }

  private isOwnAssignedScope(role: unknown): boolean {
    const r = String(role || '').trim().toLowerCase();
    return r === 'sales executive' || r === 'sales manager';
  }

  /** `YYYY-MM-DD` only; returns null if invalid. */
  private parseYmdFilter(v: unknown): string | null {
    if (v == null || v === '') return null;
    const s = String(v).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, mo, d] = s.split('-').map(Number);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return s;
  }

  private ymdNextDayUtcIso(ymd: string): string {
    const [y, mo, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString();
  }

  /**
   * For Sales Executive / Sales Manager list scope: user id whose `assigned_to`/`created_by` rows are visible.
   * Sales Manager may pass `filters.assigned_to` = a reporting executive to narrow the pipeline.
   */
  private async resolveScopedLeadUserId(
    filters: any,
    currentUser?: { id?: unknown; role?: unknown },
  ): Promise<number | null> {
    const uid = Number(currentUser?.id);
    if (!this.isOwnAssignedScope(currentUser?.role) || !Number.isInteger(uid) || uid <= 0) return null;

    const roleStr = String(currentUser?.role || '').trim().toLowerCase();
    if (roleStr === 'sales manager') {
      const raw = filters?.assigned_to;
      if (raw != null && String(raw).trim() !== '') {
        const execId = Number(raw);
        if (Number.isInteger(execId) && execId > 0 && execId !== uid) {
          const v = await this.db.query(
            `SELECT 1 FROM users
              WHERE id = $1 AND role = 'Sales Executive' AND is_active = TRUE AND sales_manager_id = $2`,
            [execId, uid],
          );
          if (v.rows[0]) return execId;
        }
      }
    }
    return uid;
  }

  /** Sales executives reporting to the current user (Sales Manager only; others get []). */
  async reportingExecutives(currentUser?: { id?: unknown; role?: unknown }) {
    const uid = Number(currentUser?.id);
    const roleStr = String(currentUser?.role || '').trim().toLowerCase();
    if (roleStr !== 'sales manager' || !Number.isInteger(uid) || uid <= 0) return [];
    const res = await this.db.query(
      `SELECT id, name, email FROM users
        WHERE role = 'Sales Executive' AND is_active = TRUE AND sales_manager_id = $1
       ORDER BY LOWER(name)`,
      [uid],
    );
    return res.rows;
  }

  /** Shared WHERE for lead list + count (`l` alias). Strips `page` / `page_size` / `limit` from filters. */
  private buildLeadListWhere(
    filters: any,
    currentUser?: { id?: unknown; role?: unknown },
    scopedUserId: number | null = null,
  ): { where: string; vals: any[] } {
    const f = filters && typeof filters === 'object' ? { ...filters } : {};
    delete f.page;
    delete f.page_size;
    delete f.limit;
    delete f.created_from;
    delete f.created_to;

    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;

    const createdFromYmd = this.parseYmdFilter(filters?.created_from);
    const createdToYmd = this.parseYmdFilter(filters?.created_to);
    if (createdFromYmd) {
      conds.push(`l.created_at >= $${i++}::timestamptz`);
      vals.push(`${createdFromYmd}T00:00:00.000Z`);
    }
    if (createdToYmd) {
      conds.push(`l.created_at < $${i++}::timestamptz`);
      vals.push(this.ymdNextDayUtcIso(createdToYmd));
    }
    const uid = Number(currentUser?.id);
    const forceOwn = this.isOwnAssignedScope(currentUser?.role) && Number.isInteger(uid) && uid > 0;
    if (scopedUserId != null && scopedUserId > 0) {
      conds.push(`(l.assigned_to=$${i} OR l.created_by=$${i})`);
      vals.push(scopedUserId);
      i++;
    }
    if (f.stage_id) {
      conds.push(`l.stage_id=$${i++}`);
      vals.push(f.stage_id);
    }
    if (f.source_id) {
      conds.push(`l.source_id=$${i++}`);
      vals.push(f.source_id);
    }
    if (!forceOwn && f.assigned_to) {
      conds.push(`l.assigned_to=$${i++}`);
      vals.push(f.assigned_to);
    }
    if (f.assigned_manager_id) {
      conds.push(`l.assigned_manager_id=$${i++}`);
      vals.push(f.assigned_manager_id);
    }
    if (f.priority) {
      conds.push(`l.priority=$${i++}`);
      vals.push(f.priority);
    }
    if (f.lead_segment) {
      conds.push(`l.lead_segment=$${i++}`);
      vals.push(f.lead_segment);
    }
    if (f.search) {
      const term = `%${f.search}%`;
      conds.push(`(
        l.name ILIKE $${i} OR l.email ILIKE $${i} OR l.company ILIKE $${i} OR l.phone ILIKE $${i}
        OR l.website ILIKE $${i} OR l.address ILIKE $${i} OR l.job_title ILIKE $${i}
        OR l.lead_segment ILIKE $${i}
        OR COALESCE(array_to_string(l.tags, ' '), '') ILIKE $${i}
      )`);
      vals.push(term);
      i++;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return { where, vals };
  }

  /**
   * Without `page` query: returns a plain array (backward compatible with mobile).
   * With `page` (>=1): returns `{ data, total, page, page_size }`.
   */
  async list(filters: any, currentUser?: { id?: unknown; role?: unknown }) {
    const scopedUserId = await this.resolveScopedLeadUserId(filters, currentUser);
    const { where, vals } = this.buildLeadListWhere(filters, currentUser, scopedUserId);
    const orderBy = `ORDER BY
         CASE l.priority WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END,
         l.created_at DESC`;
    const selectFrom = `SELECT l.*,ls.name AS stage,s.name AS source,u.name AS assigned_name, um.name AS assigned_manager_name
       FROM leads l
       LEFT JOIN lead_stages ls ON ls.id=l.stage_id
       LEFT JOIN lead_sources s  ON s.id=l.source_id
       LEFT JOIN users u         ON u.id=l.assigned_to
       LEFT JOIN users um        ON um.id=l.assigned_manager_id`;

    const pageRaw = filters?.page;
    const usePagination =
      pageRaw !== undefined &&
      pageRaw !== null &&
      pageRaw !== '' &&
      Number.isFinite(Number(pageRaw)) &&
      Number(pageRaw) >= 1;

    if (!usePagination) {
      const res = await this.db.query(`${selectFrom} ${where} ${orderBy}`, vals);
      return res.rows;
    }

    const page = Math.max(1, Math.floor(Number(pageRaw)));
    let pageSize = Math.floor(Number(filters?.page_size ?? filters?.limit ?? 25));
    if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 25;
    pageSize = Math.min(100, pageSize);
    const offset = (page - 1) * pageSize;

    const countRes = await this.db.query(`SELECT COUNT(*)::int AS n FROM leads l ${where}`, vals);
    const total = Number(countRes.rows[0]?.n ?? 0);

    const limIdx = vals.length + 1;
    const offIdx = vals.length + 2;
    const dataRes = await this.db.query(
      `${selectFrom} ${where} ${orderBy} LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...vals, pageSize, offset],
    );
    return { data: dataRes.rows, total, page, page_size: pageSize };
  }

  async get(id: number, currentUser?: { id?: unknown; role?: unknown }) {
    const conds = ['l.id=$1'];
    const vals: any[] = [id];
    const uid = Number(currentUser?.id);
    const roleStr = String(currentUser?.role || '').trim().toLowerCase();
    if (this.isOwnAssignedScope(currentUser?.role) && Number.isInteger(uid) && uid > 0) {
      if (roleStr === 'sales manager') {
        conds.push(`(
          l.assigned_to = $2 OR l.created_by = $2
          OR EXISTS (
            SELECT 1 FROM users ex
             WHERE ex.id = l.assigned_to AND ex.role = 'Sales Executive' AND ex.is_active = TRUE
               AND ex.sales_manager_id = $2
          )
          OR EXISTS (
            SELECT 1 FROM users ex
             WHERE ex.id = l.created_by AND ex.role = 'Sales Executive' AND ex.is_active = TRUE
               AND ex.sales_manager_id = $2
          )
        )`);
        vals.push(uid);
      } else {
        conds.push(`(l.assigned_to=$2 OR l.created_by=$2)`);
        vals.push(uid);
      }
    }
    const res = await this.db.query(
      `SELECT l.*,ls.name AS stage,s.name AS source,u.name AS assigned_name, um.name AS assigned_manager_name
       FROM leads l
       LEFT JOIN lead_stages ls ON ls.id=l.stage_id
       LEFT JOIN lead_sources s  ON s.id=l.source_id
       LEFT JOIN users u         ON u.id=l.assigned_to
       LEFT JOIN users um        ON um.id=l.assigned_manager_id
       WHERE ${conds.join(' AND ')}`, vals,
    );
    return res.rows[0] || null;
  }

  async create(data: any) {
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const res = await this.db.query(
      `INSERT INTO leads (
         name,email,phone,company,source_id,stage_id,assigned_to,assigned_manager_id,notes,priority,custom_fields,
         lead_segment,job_title,deal_size,website,address,tags,lead_score,created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::text[],$18,$19) RETURNING *`,
      [
        data.name, data.email, data.phone, data.company, data.source_id,
        data.stage_id, data.assigned_to || null, data.assigned_manager_id || null, data.notes,
        data.priority || 'warm',
        data.custom_fields ? JSON.stringify(data.custom_fields) : null,
        data.lead_segment ?? null,
        data.job_title ?? null,
        data.deal_size ?? null,
        data.website ?? null,
        data.address ?? null,
        tags,
        data.lead_score != null ? Number(data.lead_score) : 0,
        data.created_by ?? null,
      ],
    );
    const row = res.rows[0];
    await this.cache.delPattern('leads:*');
    await this.invalidateDashboardCache();
    if (row.assigned_to) {
      await this.notifyCrmLead(Number(row.assigned_to), row, `New lead assigned: ${row.name}`);
    }
    return row;
  }

  async update(id: number, data: any) {
    let prevAssignee: number | null | undefined;
    if (data.assigned_to !== undefined) {
      const cur = await this.get(id);
      prevAssignee = cur ? (cur.assigned_to != null ? Number(cur.assigned_to) : null) : null;
    }
    const fields = [
      'name', 'email', 'phone', 'company', 'source_id', 'stage_id', 'assigned_to', 'assigned_manager_id', 'notes',
      'priority', 'custom_fields', 'is_converted', 'lead_score',
      'lead_segment', 'job_title', 'deal_size', 'website', 'address', 'tags',
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const f of fields) {
      if (data[f] !== undefined) {
        if (f === 'tags') {
          sets.push(`tags=$${i++}::text[]`);
          vals.push(Array.isArray(data.tags) ? data.tags.map(String) : []);
        } else {
          sets.push(`${f}=$${i++}`);
          vals.push(f === 'custom_fields' ? JSON.stringify(data[f]) : data[f]);
        }
      }
    }
    if (!sets.length) return null;
    sets.push('updated_at=NOW()');
    vals.push(id);
    const res = await this.db.query(
      `UPDATE leads SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals,
    );
    await this.cache.del(`lead:${id}`);
    await this.invalidateDashboardCache();
    const updated = res.rows[0];
    if (
      data.assigned_to !== undefined &&
      updated &&
      data.assigned_to != null &&
      Number(data.assigned_to) !== (prevAssignee ?? null)
    ) {
      await this.notifyCrmLead(Number(data.assigned_to), updated, `Lead reassigned to you: ${updated.name}`);
    }
    return updated;
  }

  async remove(id: number) {
    await this.db.query('DELETE FROM leads WHERE id=$1', [id]);
    await this.cache.del(`lead:${id}`);
    await this.invalidateDashboardCache();
  }

  async stages()  { return (await this.db.query('SELECT * FROM lead_stages ORDER BY position')).rows; }
  async sources() { return (await this.db.query('SELECT * FROM lead_sources ORDER BY name')).rows; }

  // ─── Masters CRUD ──────────────────────────────────────────
  private masterCrud(table: string) {
    return {
      list:   () => this.db.query(`SELECT * FROM ${table} ORDER BY name`).then(r => r.rows),
      create: (name: string, extra: Record<string, any> = {}) => {
        const cols = ['name', ...Object.keys(extra)];
        const vals = [name, ...Object.values(extra)];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        return this.db.query(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
          vals,
        ).then(r => r.rows[0]);
      },
      update: (id: number, name: string, extra: Record<string, any> = {}) => {
        const sets = ['name=$1', ...Object.keys(extra).map((k, i) => `${k}=$${i + 2}`)];
        const vals = [name, ...Object.values(extra), id];
        return this.db.query(
          `UPDATE ${table} SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
          vals,
        ).then(r => r.rows[0] || null);
      },
      remove: (id: number) => this.db.query(`DELETE FROM ${table} WHERE id=$1`, [id]),
    };
  }

  masterSources()  { return this.masterCrud('lead_sources'); }
  masterSegments() { return this.masterCrud('crm_segments'); }
  masterPriorities() { return this.masterCrud('crm_priorities'); }

  /** Per-source lead counts + total (for “All lists” mobile UI). */
  async sourceCounts(currentUser?: { id?: unknown; role?: unknown }, filters?: any) {
    const scoped = await this.resolveScopedLeadUserId(filters ?? {}, currentUser);
    const useScope = scoped != null && scoped > 0;
    const scopeJoin = useScope ? 'AND (l.assigned_to = $1 OR l.created_by = $1)' : '';
    const totalSql = useScope
      ? 'SELECT COUNT(*)::int AS total FROM leads WHERE (assigned_to = $1 OR created_by = $1)'
      : 'SELECT COUNT(*)::int AS total FROM leads';
    const scopeArgs = useScope ? [scoped] : [];
    const [bySource, totalRow] = await Promise.all([
      this.db.query(`
        SELECT s.id, s.name, COUNT(l.id)::int AS lead_count
        FROM lead_sources s
        LEFT JOIN leads l ON l.source_id = s.id ${scopeJoin}
        GROUP BY s.id, s.name
        ORDER BY s.name
      `, scopeArgs),
      this.db.query(totalSql, scopeArgs),
    ]);
    return {
      total: Number(totalRow.rows[0]?.total ?? 0),
      sources: bySource.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        lead_count: Number(r.lead_count),
      })),
    };
  }
  async assignees() {
    const res = await this.db.query(`
      SELECT id, name, role
      FROM users
      WHERE is_active=TRUE
        AND LOWER(COALESCE(role, '')) <> 'super admin'
      ORDER BY
        CASE WHEN LOWER(COALESCE(role, '')) = 'manager' THEN 0 ELSE 1 END,
        name
    `);
    return res.rows;
  }

  async stats(currentUser?: { id?: unknown; role?: unknown }, filters?: any) {
    const scoped = await this.resolveScopedLeadUserId(filters ?? {}, currentUser);
    const useScope = scoped != null && scoped > 0;
    const whereSql = useScope ? 'WHERE (assigned_to = $1 OR created_by = $1)' : '';
    const joinScopeSql = useScope ? 'AND (l.assigned_to = $1 OR l.created_by = $1)' : '';
    const scopeArgs = useScope ? [scoped] : [];
    const [totals, byStage] = await Promise.all([
      this.db.query(`
        SELECT
          COUNT(*)                                  AS total,
          COUNT(*) FILTER (WHERE priority='hot')    AS hot,
          COUNT(*) FILTER (WHERE priority='warm')   AS warm,
          COUNT(*) FILTER (WHERE priority='cold')   AS cold,
          COUNT(*) FILTER (WHERE is_converted=TRUE) AS converted
        FROM leads
        ${whereSql}
      `, scopeArgs),
      this.db.query(`
        SELECT ls.id, ls.name, ls.position, COUNT(l.id)::int AS count
          FROM lead_stages ls
          LEFT JOIN leads l ON l.stage_id = ls.id ${joinScopeSql}
         GROUP BY ls.id, ls.name, ls.position
         ORDER BY ls.position
      `, scopeArgs),
    ]);
    const t = totals.rows[0];
    return {
      total:      Number(t.total),
      hot:        Number(t.hot),
      warm:       Number(t.warm),
      cold:       Number(t.cold),
      converted:  Number(t.converted),
      conversion: t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0,
      by_stage:   byStage.rows,
    };
  }

  async activities(leadId: number) {
    const res = await this.db.query(
      `SELECT a.*,u.name AS user_name FROM lead_activities a
       LEFT JOIN users u ON u.id=a.user_id WHERE a.lead_id=$1 ORDER BY a.created_at DESC`, [leadId],
    );
    return res.rows;
  }

  async addActivity(leadId: number, userId: number, type: string, description: string) {
    const res = await this.db.query(
      'INSERT INTO lead_activities (lead_id,user_id,type,description) VALUES ($1,$2,$3,$4) RETURNING *',
      [leadId, userId, type, description],
    );
    return res.rows[0];
  }

  async followups(leadId: number) {
    const res = await this.db.query(
      `SELECT f.*,u.name AS assigned_name FROM lead_followups f
       LEFT JOIN users u ON u.id=f.assigned_to WHERE f.lead_id=$1 ORDER BY f.due_date ASC`, [leadId],
    );
    return res.rows;
  }

  async addFollowup(leadId: number, data: any) {
    const res = await this.db.query(
      'INSERT INTO lead_followups (lead_id,assigned_to,due_date,description) VALUES ($1,$2,$3,$4) RETURNING *',
      [leadId, data.assigned_to || null, data.due_date, data.description || null],
    );
    await this.invalidateDashboardCache();
    const row = res.rows[0];
    if (row.assigned_to) {
      const lead = await this.get(leadId);
      const name = lead?.name ?? 'Lead';
      await this.notifyCrmLead(
        Number(row.assigned_to),
        { id: leadId, name, company: lead?.company },
        'Follow-up scheduled',
        row.description || null,
      );
    }
    return row;
  }

  async allFollowups(filters: any, currentUser?: { id?: unknown; role?: unknown }) {
    const conds = ['f.is_done=FALSE'];
    const vals: any[] = [];
    let i = 1;
    const uid = Number(currentUser?.id);
    const forceOwn = this.isOwnAssignedScope(currentUser?.role) && Number.isInteger(uid) && uid > 0;
    const scoped = await this.resolveScopedLeadUserId(filters || {}, currentUser);
    if (scoped != null && scoped > 0) {
      conds.push(`(l.assigned_to=$${i} OR l.created_by=$${i})`);
      vals.push(scoped);
      i++;
    }
    if (!forceOwn && filters.assigned_to) { conds.push(`f.assigned_to=$${i++}`); vals.push(filters.assigned_to); }
    const res = await this.db.query(
      `SELECT
          f.*,
          l.name AS lead_name,
          l.company AS lead_company,
          l.lead_score AS lead_score,
          ls.name AS lead_stage,
          u.name AS assigned_name
         FROM lead_followups f
         JOIN leads l ON l.id = f.lead_id
         LEFT JOIN lead_stages ls ON ls.id = l.stage_id
         LEFT JOIN users u ON u.id = f.assigned_to
        WHERE ${conds.join(' AND ')}
        ORDER BY f.due_date ASC
        LIMIT 200`,
      vals,
    );
    return res.rows;
  }

  async doneFollowup(leadId: number, fid: number) {
    const res = await this.db.query(
      'UPDATE lead_followups SET is_done=TRUE WHERE id=$1 AND lead_id=$2 RETURNING *',
      [fid, leadId],
    );
    if (!res.rows[0]) throw new NotFoundException('Follow-up not found');
    await this.invalidateDashboardCache();
    return res.rows[0];
  }

  async updateFollowup(
    leadId: number,
    fid: number,
    data: { due_date?: string; description?: string; assigned_to?: number | null },
  ) {
    const cur = await this.db.query(
      'SELECT id FROM lead_followups WHERE id=$1 AND lead_id=$2',
      [fid, leadId],
    );
    if (!cur.rows[0]) throw new NotFoundException('Follow-up not found');
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (data.due_date !== undefined) {
      sets.push(`due_date=$${i++}`);
      vals.push(data.due_date);
    }
    if (data.description !== undefined) {
      sets.push(`description=$${i++}`);
      vals.push(data.description);
    }
    if (data.assigned_to !== undefined) {
      sets.push(`assigned_to=$${i++}`);
      vals.push(data.assigned_to);
    }
    if (!sets.length) {
      const r = await this.db.query('SELECT * FROM lead_followups WHERE id=$1 AND lead_id=$2', [fid, leadId]);
      return r.rows[0];
    }
    vals.push(fid, leadId);
    const res = await this.db.query(
      `UPDATE lead_followups SET ${sets.join(', ')} WHERE id=$${i++} AND lead_id=$${i} RETURNING *`,
      vals,
    );
    await this.invalidateDashboardCache();
    return res.rows[0];
  }

  async deleteFollowup(leadId: number, fid: number) {
    const res = await this.db.query(
      'DELETE FROM lead_followups WHERE id=$1 AND lead_id=$2 RETURNING id',
      [fid, leadId],
    );
    if (!res.rows[0]) throw new NotFoundException('Follow-up not found');
    await this.invalidateDashboardCache();
    return { deleted: true };
  }

  /**
   * Create a sales `customers` row from the lead’s contact fields and link `lead_id`.
   * Marks the lead `is_converted`. Idempotent if a customer already exists for this lead.
   */
  async convertLeadToCustomer(leadId: number, currentUser?: { id?: unknown; role?: unknown }) {
    const lead = await this.get(leadId, currentUser);
    if (!lead) throw new NotFoundException('Lead not found');

    const dup = await this.db.query('SELECT * FROM customers WHERE lead_id=$1 LIMIT 1', [leadId]);
    if (dup.rows[0]) {
      await this.db.query(
        'UPDATE leads SET is_converted=TRUE, updated_at=NOW() WHERE id=$1 AND is_converted=FALSE',
        [leadId],
      );
      await this.cache.delPattern('leads:*');
      return { customer: dup.rows[0], already_existed: true };
    }

    const nameRaw = String(lead.name || '').trim();
    const company = String(lead.company || '').trim();
    const name = nameRaw || company || `Lead #${leadId}`;
    const email =
      lead.email != null && String(lead.email).trim() ? String(lead.email).trim().slice(0, 255) : null;
    const phone =
      lead.phone != null && String(lead.phone).trim() ? String(lead.phone).trim().slice(0, 20) : null;
    if (!email && !phone) {
      throw new BadRequestException('Add an email or phone on the lead before converting to customer.');
    }
    const address =
      lead.address != null && String(lead.address).trim() ? String(lead.address).trim() : null;

    const customer = await this.db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO customers (name, email, phone, gstin, address, lead_id)
         VALUES ($1, $2, $3, NULL, $4, $5) RETURNING *`,
        [name, email, phone, address, leadId],
      );
      await client.query('UPDATE leads SET is_converted=TRUE, updated_at=NOW() WHERE id=$1', [leadId]);
      return ins.rows[0];
    });

    await this.cache.delPattern('leads:*');
    await this.cache.delPattern('customers:*');
    await this.invalidateDashboardCache();
    return { customer, already_existed: false };
  }
}
