import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CommunicationService {
  constructor(private readonly db: DatabaseService) {}

  async listTemplates() { return (await this.db.query('SELECT * FROM comm_templates ORDER BY channel,name')).rows; }
  async createTemplate(d: any) {
    return (await this.db.query(
      'INSERT INTO comm_templates (name,channel,subject,body) VALUES ($1,$2,$3,$4) RETURNING *',
      [d.name, d.channel, d.subject, d.body],
    )).rows[0];
  }
  async updateTemplate(id: number, d: any) {
    return (await this.db.query(
      'UPDATE comm_templates SET name=$1,channel=$2,subject=$3,body=$4 WHERE id=$5 RETURNING *',
      [d.name, d.channel, d.subject, d.body, id],
    )).rows[0];
  }
  async deleteTemplate(id: number) { await this.db.query('DELETE FROM comm_templates WHERE id=$1', [id]); }

  async listLogs(filters: { lead_id?: number; channel?: string }) {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if(filters.lead_id) { conds.push(`lead_id=$${i++}`); vals.push(filters.lead_id); }
    if(filters.channel) { conds.push(`channel=$${i++}`); vals.push(filters.channel); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT cl.*,u.name AS sent_by_name FROM comm_logs cl LEFT JOIN users u ON u.id=cl.sent_by ${where} ORDER BY cl.sent_at DESC`, vals
    )).rows;
  }
  async createLog(d: any) {
    return (await this.db.query(
      'INSERT INTO comm_logs (lead_id,channel,recipient,subject,body,status,sent_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [d.lead_id, d.channel, d.recipient, d.subject, d.body, d.status||'sent', d.sent_by],
    )).rows[0];
  }
}
