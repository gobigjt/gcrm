import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CommunicationService {
  constructor(private readonly db: DatabaseService) {}

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  async listTemplates(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'SELECT * FROM comm_templates WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY channel,name',
      [tenantId],
    )).rows;
  }
  async createTemplate(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO comm_templates (name,channel,subject,body,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [d.name, d.channel, d.subject, d.body, tenantId || null],
    )).rows[0];
  }
  async updateTemplate(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'UPDATE comm_templates SET name=$1,channel=$2,subject=$3,body=$4 WHERE id=$5 AND ($6::integer = 0 OR tenant_id = $6) RETURNING *',
      [d.name, d.channel, d.subject, d.body, id, tenantId],
    )).rows[0];
  }
  async deleteTemplate(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    await this.db.query('DELETE FROM comm_templates WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }

  async listLogs(filters: { lead_id?: number; channel?: string }, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const conds: string[] = ['($1::integer = 0 OR cl.tenant_id = $1)']; const vals: any[] = [tenantId]; let i = 2;
    if(filters.lead_id) { conds.push(`lead_id=$${i++}`); vals.push(filters.lead_id); }
    if(filters.channel) { conds.push(`channel=$${i++}`); vals.push(filters.channel); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT cl.*,u.name AS sent_by_name FROM comm_logs cl LEFT JOIN users u ON u.id=cl.sent_by ${where} ORDER BY cl.sent_at DESC`, vals
    )).rows;
  }

  async listWhatsAppInbox(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    // Latest WhatsApp message per lead (inbox view).
    // DISTINCT ON is a Postgres feature; order ensures the latest per lead_id is returned.
    return (await this.db.query(
      `SELECT DISTINCT ON (cl.lead_id)
          cl.lead_id,
          cl.body        AS last_body,
          cl.sent_at     AS last_sent_at,
          u.name         AS last_sent_by_name,
          l.name         AS lead_name,
          l.company      AS lead_company,
          l.phone        AS lead_phone,
          ls.name        AS lead_stage,
          l.lead_score   AS lead_score
        FROM comm_logs cl
        JOIN leads l ON l.id = cl.lead_id
        LEFT JOIN lead_stages ls ON ls.id = l.stage_id
        LEFT JOIN users u ON u.id = cl.sent_by
       WHERE cl.channel = 'whatsapp' AND cl.lead_id IS NOT NULL
         AND ($1::integer = 0 OR cl.tenant_id = $1)
       ORDER BY cl.lead_id, cl.sent_at DESC
       LIMIT 200`,
      [tenantId],
    )).rows;
  }
  async createLog(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO comm_logs (lead_id,channel,recipient,subject,body,status,sent_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [d.lead_id, d.channel, d.recipient, d.subject, d.body, d.status||'sent', d.sent_by, tenantId || null],
    )).rows[0];
  }
}
