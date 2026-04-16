import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class PurchaseService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new ForbiddenException('Tenant context is required');
    return tenantId;
  }

  async listVendors(search?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const vals: any[] = [tenantId];
    let where = 'WHERE ($1::integer = 0 OR tenant_id = $1)';
    if (search) {
      vals.push(`%${search}%`);
      where += ' AND (name ILIKE $2 OR email ILIKE $2)';
    }
    return (await this.db.query(`SELECT * FROM vendors ${where} ORDER BY name`, vals)).rows;
  }
  async getVendor(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('SELECT * FROM vendors WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId])).rows[0];
  }
  async createVendor(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO vendors (name,email,phone,gstin,address,tenant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [d.name, d.email, d.phone, d.gstin, d.address, tenantId || null],
    )).rows[0];
  }
  async updateVendor(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const fields = ['name','email','phone','gstin','address','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id, tenantId);
    return (await this.db.query(`UPDATE vendors SET ${sets.join(',')} WHERE id=$${i} AND ($${i+1}::integer = 0 OR tenant_id = $${i+1}) RETURNING *`, vals)).rows[0];
  }

  async listPOs(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT po.*,v.name AS vendor_name FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id
       WHERE ($1::integer = 0 OR po.tenant_id = $1)
       ORDER BY po.created_at DESC`, [tenantId]
    )).rows;
  }
  async getPO(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const [po, items] = await Promise.all([
      this.db.query(`SELECT po.*,v.name AS vendor_name FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id WHERE po.id=$1 AND ($2::integer = 0 OR po.tenant_id = $2)`, [id, tenantId]),
      this.db.query(`SELECT poi.*,p.name AS product_name FROM purchase_order_items poi JOIN products p ON p.id=poi.product_id WHERE poi.po_id=$1 AND ($2::integer = 0 OR poi.tenant_id = $2)`, [id, tenantId]),
    ]);
    return po.rows[0] ? { ...po.rows[0], items: items.rows } : null;
  }
  async createPO(data: any, items: any[], ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return this.db.transaction(async (client) => {
      const total = items.reduce((s, i) => s + Number(i.total), 0);
      const pn = `PO-${Date.now()}`;
      const pr = await client.query(
        'INSERT INTO purchase_orders (po_number,vendor_id,status,order_date,expected_date,notes,total_amount,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [pn, data.vendor_id, 'draft', data.order_date||new Date().toISOString().split('T')[0], data.expected_date, data.notes, total, data.created_by, tenantId || null],
      );
      for (const it of items)
        await client.query('INSERT INTO purchase_order_items (po_id,product_id,quantity,unit_price,gst_rate,total,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [pr.rows[0].id, it.product_id, it.quantity, it.unit_price, it.gst_rate||0, it.total, tenantId || null]);
      return pr.rows[0];
    });
  }
  async patchPO(id: number, status: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('UPDATE purchase_orders SET status=$1 WHERE id=$2 AND ($3::integer = 0 OR tenant_id = $3) RETURNING *', [status, id, tenantId])).rows[0];
  }

  async listGRNs(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT g.*,po.po_number,v.name AS vendor_name FROM grn g
       JOIN purchase_orders po ON po.id=g.po_id JOIN vendors v ON v.id=po.vendor_id
       WHERE ($1::integer = 0 OR g.tenant_id = $1)
       ORDER BY g.received_at DESC`, [tenantId]
    )).rows;
  }
  async getGRN(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const [g, items] = await Promise.all([
      this.db.query(`SELECT g.*,po.po_number FROM grn g JOIN purchase_orders po ON po.id=g.po_id WHERE g.id=$1 AND ($2::integer = 0 OR g.tenant_id = $2)`, [id, tenantId]),
      this.db.query(`SELECT gi.*,p.name AS product_name,w.name AS warehouse_name FROM grn_items gi JOIN products p ON p.id=gi.product_id JOIN warehouses w ON w.id=gi.warehouse_id WHERE gi.grn_id=$1 AND ($2::integer = 0 OR gi.tenant_id = $2)`, [id, tenantId]),
    ]);
    return g.rows[0] ? { ...g.rows[0], items: items.rows } : null;
  }
  async createGRN(data: any, items: any[], ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return this.db.transaction(async (client) => {
      const gn = `GRN-${Date.now()}`;
      const gr = await client.query('INSERT INTO grn (grn_number,po_id,notes,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [gn, data.po_id, data.notes, data.created_by, tenantId || null]);
      for (const it of items) {
        await client.query('INSERT INTO grn_items (grn_id,product_id,quantity,warehouse_id,tenant_id) VALUES ($1,$2,$3,$4,$5)', [gr.rows[0].id, it.product_id, it.quantity, it.warehouse_id, tenantId || null]);
        await client.query(
          `INSERT INTO stock (product_id,warehouse_id,quantity,tenant_id) VALUES ($1,$2,$3,$4)
           ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity=stock.quantity+$3,updated_at=NOW(),tenant_id=COALESCE(stock.tenant_id,EXCLUDED.tenant_id)`,
          [it.product_id, it.warehouse_id, it.quantity, tenantId || null],
        );
        await client.query('INSERT INTO stock_movements (product_id,warehouse_id,type,quantity,reference,created_by,tenant_id) VALUES ($1,$2,\'in\',$3,$4,$5,$6)',
          [it.product_id, it.warehouse_id, it.quantity, gn, data.created_by, tenantId || null]);
      }
      await client.query('UPDATE purchase_orders SET status=\'received\' WHERE id=$1', [data.po_id]);
      return gr.rows[0];
    });
  }

  async listPurchaseInvoices(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT pi.*,v.name AS vendor_name FROM purchase_invoices pi JOIN vendors v ON v.id=pi.vendor_id
       WHERE ($1::integer = 0 OR pi.tenant_id = $1)
       ORDER BY pi.created_at DESC`, [tenantId]
    )).rows;
  }
  async stats(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM vendors WHERE is_active=TRUE AND ($1::integer = 0 OR tenant_id = $1))                                   AS vendors,
        (SELECT COUNT(*)::int FROM purchase_orders WHERE status NOT IN ('received','cancelled') AND ($1::integer = 0 OR tenant_id = $1))   AS pending_pos,
        (SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE status NOT IN ('cancelled') AND ($1::integer = 0 OR tenant_id = $1)) AS total_po_value,
        (SELECT COUNT(*)::int FROM grn WHERE created_at >= date_trunc('month', NOW()) AND ($1::integer = 0 OR tenant_id = $1))             AS grns_this_month
    `, [tenantId]);
    const r = res.rows[0];
    return { vendors: r.vendors, pending_pos: r.pending_pos, total_po_value: Number(r.total_po_value), grns_this_month: r.grns_this_month };
  }

  async deleteVendor(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    await this.db.query('DELETE FROM vendors WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }
  async deletePO(id: number, ctx?: any)     {
    const tenantId = this.requireTenantId(ctx);
    await this.db.query('DELETE FROM purchase_orders WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }

  async createPurchaseInvoice(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO purchase_invoices (invoice_number,vendor_id,po_id,invoice_date,due_date,amount,gst_amount,total_amount,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [d.invoice_number, d.vendor_id, d.po_id, d.invoice_date, d.due_date, d.amount, d.gst_amount||0, d.total_amount, tenantId || null],
    )).rows[0];
  }
}
