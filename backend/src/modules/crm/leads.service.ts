import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: RedisService,
  ) {}

  async list(filters: any) {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.stage_id)    { conds.push(`l.stage_id=$${i++}`);    vals.push(filters.stage_id); }
    if (filters.source_id)   { conds.push(`l.source_id=$${i++}`);   vals.push(filters.source_id); }
    if (filters.assigned_to) { conds.push(`l.assigned_to=$${i++}`); vals.push(filters.assigned_to); }
    if (filters.priority)    { conds.push(`l.priority=$${i++}`);    vals.push(filters.priority); }
    if (filters.search) {
      conds.push(`(l.name ILIKE $${i} OR l.email ILIKE $${i} OR l.company ILIKE $${i} OR l.phone ILIKE $${i})`);
      vals.push(`%${filters.search}%`); i++;
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
    const res = await this.db.query(
      `INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.name, data.email, data.phone, data.company, data.source_id,
       data.stage_id, data.assigned_to || null, data.notes,
       data.priority || 'warm',
       data.custom_fields ? JSON.stringify(data.custom_fields) : null],
    );
    await this.cache.delPattern('leads:*');
    return res.rows[0];
  }

  async update(id: number, data: any) {
    const fields = ['name','email','phone','company','source_id','stage_id','assigned_to','notes','priority','custom_fields','is_converted','lead_score'];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f}=$${i++}`);
        vals.push(f === 'custom_fields' ? JSON.stringify(data[f]) : data[f]);
      }
    }
    if (!sets.length) return null;
    sets.push('updated_at=NOW()');
    vals.push(id);
    const res = await this.db.query(
      `UPDATE leads SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals,
    );
    await this.cache.del(`lead:${id}`);
    return res.rows[0];
  }

  async remove(id: number) {
    await this.db.query('DELETE FROM leads WHERE id=$1', [id]);
    await this.cache.del(`lead:${id}`);
  }

  async stages()  { return (await this.db.query('SELECT * FROM lead_stages ORDER BY position')).rows; }
  async sources() { return (await this.db.query('SELECT * FROM lead_sources ORDER BY name')).rows; }
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
    return res.rows[0];
  }

  async allFollowups(filters: any) {
    const conds = ['f.is_done=FALSE'];
    const vals: any[] = [];
    let i = 1;
    if (filters.assigned_to) { conds.push(`f.assigned_to=$${i++}`); vals.push(filters.assigned_to); }
    const res = await this.db.query(
      `SELECT f.*, l.name AS lead_name, l.company AS lead_company, u.name AS assigned_name
         FROM lead_followups f
         JOIN leads l ON l.id = f.lead_id
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
    return res.rows[0];
  }
}
