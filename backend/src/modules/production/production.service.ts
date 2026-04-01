import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProductionService {
  constructor(private readonly db: DatabaseService) {}

  async listBOMs() {
    return (await this.db.query(`SELECT b.*,p.name AS product_name FROM bom b JOIN products p ON p.id=b.product_id ORDER BY b.created_at DESC`)).rows;
  }
  async getBOM(id: number) {
    const [b, items] = await Promise.all([
      this.db.query(`SELECT b.*,p.name AS product_name FROM bom b JOIN products p ON p.id=b.product_id WHERE b.id=$1`, [id]),
      this.db.query(`SELECT bi.*,p.name AS component_name FROM bom_items bi JOIN products p ON p.id=bi.component_id WHERE bi.bom_id=$1`, [id]),
    ]);
    return b.rows[0] ? { ...b.rows[0], items: items.rows } : null;
  }
  async createBOM(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const br = await client.query('INSERT INTO bom (product_id,name,version) VALUES ($1,$2,$3) RETURNING *', [data.product_id, data.name, data.version||'1.0']);
      for (const it of items)
        await client.query('INSERT INTO bom_items (bom_id,component_id,quantity,unit) VALUES ($1,$2,$3,$4)', [br.rows[0].id, it.component_id, it.quantity, it.unit||'pcs']);
      return br.rows[0];
    });
  }

  async listWorkOrders(status?: string) {
    const where = status ? 'WHERE wo.status=$1' : '';
    const vals  = status ? [status] : [];
    return (await this.db.query(`SELECT wo.*,p.name AS product_name FROM work_orders wo JOIN products p ON p.id=wo.product_id ${where} ORDER BY wo.created_at DESC`, vals)).rows;
  }
  async getWorkOrder(id: number) {
    return (await this.db.query(
      `SELECT wo.*,p.name AS product_name,b.name AS bom_name FROM work_orders wo
       JOIN products p ON p.id=wo.product_id LEFT JOIN bom b ON b.id=wo.bom_id WHERE wo.id=$1`, [id]
    )).rows[0];
  }
  async createWorkOrder(data: any) {
    const wn = `WO-${Date.now()}`;
    return (await this.db.query(
      'INSERT INTO work_orders (wo_number,product_id,bom_id,quantity,status,planned_start,planned_end,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [wn, data.product_id, data.bom_id, data.quantity, 'planned', data.planned_start, data.planned_end, data.notes, data.created_by],
    )).rows[0];
  }
  async updateWorkOrder(id: number, d: any) {
    const fields = ['status','actual_start','actual_end','notes'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id);
    return (await this.db.query(`UPDATE work_orders SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals)).rows[0];
  }
}
