import { Injectable } from '@nestjs/common';
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

  async list(filters: any) {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.stage_id)    { conds.push(`l.stage_id=$${i++}`);    vals.push(filters.stage_id); }
    if (filters.source_id)   { conds.push(`l.source_id=$${i++}`);   vals.push(filters.source_id); }
    if (filters.assigned_to) { conds.push(`l.assigned_to=$${i++}`); vals.push(filters.assigned_to); }
    if (filters.priority)    { conds.push(`l.priority=$${i++}`);    vals.push(filters.priority); }
    if (filters.search) {
      const term = `%${filters.search}%`;
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
    const res = await this.db.query(
      `SELECT l.*,ls.name AS stage,s.name AS source,u.name AS assigned_name
       FROM leads l
       LEFT JOIN lead_stages ls ON ls.id=l.stage_id
       LEFT JOIN lead_sources s  ON s.id=l.source_id
       LEFT JOIN users u         ON u.id=l.assigned_to
       ${where} ORDER BY
         CASE l.priority WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END,
         l.created_at DESC`,
      vals,
    );
    return res.rows;
  }

  async get(id: number) {
    const res = await this.db.query(
      `SELECT l.*,ls.name AS stage,s.name AS source,u.name AS assigned_name
       FROM leads l
       LEFT JOIN lead_stages ls ON ls.id=l.stage_id
       LEFT JOIN lead_sources s  ON s.id=l.source_id
       LEFT JOIN users u         ON u.id=l.assigned_to
       WHERE l.id=$1`, [id],
    );
    return res.rows[0] || null;
  }

  async create(data: any) {
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const res = await this.db.query(
      `INSERT INTO leads (
         name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields,
         lead_segment,job_title,deal_size,website,address,tags,lead_score
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::text[],$17) RETURNING *`,
      [
        data.name, data.email, data.phone, data.company, data.source_id,
        data.stage_id, data.assigned_to || null, data.notes,
        data.priority || 'warm',
        data.custom_fields ? JSON.stringify(data.custom_fields) : null,
        data.lead_segment ?? null,
        data.job_title ?? null,
        data.deal_size ?? null,
        data.website ?? null,
        data.address ?? null,
        tags,
        data.lead_score != null ? Number(data.lead_score) : 0,
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
      'name', 'email', 'phone', 'company', 'source_id', 'stage_id', 'assigned_to', 'notes',
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

  /** Per-source lead counts + total (for “All lists” mobile UI). */
  async sourceCounts() {
    const [bySource, totalRow] = await Promise.all([
      this.db.query(`
        SELECT s.id, s.name, COUNT(l.id)::int AS lead_count
        FROM lead_sources s
        LEFT JOIN leads l ON l.source_id = s.id
        GROUP BY s.id, s.name
        ORDER BY s.name
      `),
      this.db.query(`SELECT COUNT(*)::int AS total FROM leads`),
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
    const res = await this.db.query("SELECT id,name FROM users WHERE is_active=TRUE ORDER BY name");
    return res.rows;
  }

  async stats() {
    const [totals, byStage] = await Promise.all([
      this.db.query(`
        SELECT
          COUNT(*)                                  AS total,
          COUNT(*) FILTER (WHERE priority='hot')    AS hot,
          COUNT(*) FILTER (WHERE priority='warm')   AS warm,
          COUNT(*) FILTER (WHERE priority='cold')   AS cold,
          COUNT(*) FILTER (WHERE is_converted=TRUE) AS converted
        FROM leads
      `),
      this.db.query(`
        SELECT ls.id, ls.name, ls.position, COUNT(l.id)::int AS count
          FROM lead_stages ls
          LEFT JOIN leads l ON l.stage_id = ls.id
         GROUP BY ls.id, ls.name, ls.position
         ORDER BY ls.position
      `),
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

  async allFollowups(filters: any) {
    const conds = ['f.is_done=FALSE'];
    const vals: any[] = [];
    let i = 1;
    if (filters.assigned_to) { conds.push(`f.assigned_to=$${i++}`); vals.push(filters.assigned_to); }
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

  async doneFollowup(fid: number) {
    const res = await this.db.query(
      'UPDATE lead_followups SET is_done=TRUE WHERE id=$1 RETURNING *', [fid],
    );
    await this.invalidateDashboardCache();
    return res.rows[0];
  }
}
