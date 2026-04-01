import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class SalesService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  // ─── Customers ────────────────────────────────────────────
  async listCustomers(search?: string) {
    const cached = await this.cache.get<any[]>(`customers:${search||''}`);
    if (cached) return cached;
    const vals = search ? [`%${search}%`] : [];
    const where = search ? 'WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1' : '';
    const res = await this.db.query(`SELECT * FROM customers ${where} ORDER BY name`, vals);
    await this.cache.set(`customers:${search||''}`, res.rows, 120);
    return res.rows;
  }
  async getCustomer(id: number) { return (await this.db.query('SELECT * FROM customers WHERE id=$1', [id])).rows[0]; }
  async createCustomer(d: any) {
    const res = await this.db.query(
      'INSERT INTO customers (name,email,phone,gstin,address,lead_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [d.name, d.email, d.phone, d.gstin, d.address, d.lead_id],
    );
    await this.cache.delPattern('customers:*');
    return res.rows[0];
  }
  async updateCustomer(id: number, d: any) {
    const fields = ['name','email','phone','gstin','address','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id);
    const res = await this.db.query(`UPDATE customers SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    await this.cache.delPattern('customers:*');
    return res.rows[0];
  }

  // ─── Proposals ────────────────────────────────────────────
  async listProposals() {
    return (await this.db.query(
      `SELECT p.*,c.name AS customer_name FROM proposals p JOIN customers c ON c.id=p.customer_id ORDER BY p.created_at DESC`
    )).rows;
  }
  async getProposal(id: number) {
    const [p, items] = await Promise.all([
      this.db.query(`SELECT p.*,c.name AS customer_name FROM proposals p JOIN customers c ON c.id=p.customer_id WHERE p.id=$1`, [id]),
      this.db.query(`SELECT pi.*,pr.name AS product_name FROM proposal_items pi LEFT JOIN products pr ON pr.id=pi.product_id WHERE pi.proposal_id=$1`, [id]),
    ]);
    return p.rows[0] ? { ...p.rows[0], items: items.rows } : null;
  }
  async createProposal(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const total = items.reduce((s, i) => s + Number(i.total), 0);
      const pn = `PROP-${Date.now()}`;
      const pr = await client.query(
        'INSERT INTO proposals (proposal_number,customer_id,lead_id,status,valid_until,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [pn, data.customer_id, data.lead_id, data.status||'draft', data.valid_until, data.notes, total, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO proposal_items (proposal_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [pr.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.total]);
      return pr.rows[0];
    });
  }
  async patchProposal(id: number, status: string) {
    return (await this.db.query('UPDATE proposals SET status=$1 WHERE id=$2 RETURNING *', [status, id])).rows[0];
  }

  // ─── Quotations ───────────────────────────────────────────
  async listQuotations() {
    return (await this.db.query(
      `SELECT q.*,c.name AS customer_name FROM quotations q JOIN customers c ON c.id=q.customer_id ORDER BY q.created_at DESC`
    )).rows;
  }
  async getQuotation(id: number) {
    const [q, items] = await Promise.all([
      this.db.query(`SELECT q.*,c.name AS customer_name FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=$1`, [id]),
      this.db.query(`SELECT qi.*,pr.name AS product_name FROM quotation_items qi LEFT JOIN products pr ON pr.id=qi.product_id WHERE qi.quotation_id=$1`, [id]),
    ]);
    return q.rows[0] ? { ...q.rows[0], items: items.rows } : null;
  }
  async createQuotation(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const total = items.reduce((s, i) => s + Number(i.total), 0);
      const qn = `QUOT-${Date.now()}`;
      const qr = await client.query(
        'INSERT INTO quotations (quotation_number,customer_id,proposal_id,status,valid_until,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [qn, data.customer_id, data.proposal_id, data.status||'draft', data.valid_until, data.notes, total, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [qr.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.total]);
      return qr.rows[0];
    });
  }

  // ─── Orders ───────────────────────────────────────────────
  async listOrders() {
    return (await this.db.query(
      `SELECT o.*,c.name AS customer_name FROM sales_orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC`
    )).rows;
  }
  async getOrder(id: number) {
    const [o, items] = await Promise.all([
      this.db.query(`SELECT o.*,c.name AS customer_name FROM sales_orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`, [id]),
      this.db.query(`SELECT oi.*,pr.name AS product_name FROM sales_order_items oi LEFT JOIN products pr ON pr.id=oi.product_id WHERE oi.order_id=$1`, [id]),
    ]);
    return o.rows[0] ? { ...o.rows[0], items: items.rows } : null;
  }
  async createOrder(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const total = items.reduce((s, i) => s + Number(i.total), 0);
      const on = `ORD-${Date.now()}`;
      const or = await client.query(
        'INSERT INTO sales_orders (order_number,customer_id,quotation_id,status,order_date,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [on, data.customer_id, data.quotation_id, data.status||'pending', data.order_date||new Date().toISOString().split('T')[0], data.notes, total, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [or.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.total]);
      return or.rows[0];
    });
  }
  async patchOrder(id: number, status: string) {
    return (await this.db.query('UPDATE sales_orders SET status=$1 WHERE id=$2 RETURNING *', [status, id])).rows[0];
  }

  // ─── Invoices ─────────────────────────────────────────────
  async listInvoices() {
    return (await this.db.query(
      `SELECT i.*,c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC`
    )).rows;
  }
  async getInvoice(id: number) {
    const [inv, items, pays] = await Promise.all([
      this.db.query(`SELECT i.*,c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=$1`, [id]),
      this.db.query(`SELECT ii.*,pr.name AS product_name FROM invoice_items ii LEFT JOIN products pr ON pr.id=ii.product_id WHERE ii.invoice_id=$1`, [id]),
      this.db.query(`SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return inv.rows[0] ? { ...inv.rows[0], items: items.rows, payments: pays.rows } : null;
  }
  async createInvoice(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
      for (const it of items) {
        subtotal += Number(it.unit_price) * Number(it.quantity);
        if (data.is_interstate) igst += Number(it.igst||0);
        else { cgst += Number(it.cgst||0); sgst += Number(it.sgst||0); }
      }
      const total = subtotal + cgst + sgst + igst;
      const inv_no = `INV-${Date.now()}`;
      const ir = await client.query(
        'INSERT INTO invoices (invoice_number,customer_id,order_id,invoice_date,due_date,subtotal,cgst,sgst,igst,total_amount,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
        [inv_no, data.customer_id, data.order_id, data.invoice_date||new Date().toISOString().split('T')[0], data.due_date, subtotal, cgst, sgst, igst, total, data.notes, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [ir.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return ir.rows[0];
    });
  }
  async stats() {
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int        FROM customers  WHERE is_active=TRUE)                                    AS customers,
        (SELECT COUNT(*)::int        FROM sales_orders WHERE status NOT IN ('delivered','cancelled'))          AS open_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                              AS revenue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial'))             AS receivable,
        (SELECT COUNT(*)::int        FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW()) AS overdue
    `);
    const r = res.rows[0];
    return { customers: r.customers, open_orders: r.open_orders, revenue: Number(r.revenue), receivable: Number(r.receivable), overdue: r.overdue };
  }

  async deleteCustomer(id: number)   { await this.db.query('DELETE FROM customers WHERE id=$1', [id]); await this.cache.delPattern('customers:*'); }
  async deleteQuotation(id: number)  { await this.db.query('DELETE FROM quotations WHERE id=$1', [id]); }
  async deleteOrder(id: number)      { await this.db.query('DELETE FROM sales_orders WHERE id=$1', [id]); }
  async deleteInvoice(id: number)    { await this.db.query('DELETE FROM invoices WHERE id=$1', [id]); }

  async patchQuotation(id: number, status: string) {
    return (await this.db.query('UPDATE quotations SET status=$1 WHERE id=$2 RETURNING *', [status, id])).rows[0];
  }

  async addPayment(invoiceId: number, data: any) {
    return this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO payments (invoice_id,amount,payment_date,method,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [invoiceId, data.amount, data.payment_date||new Date().toISOString().split('T')[0], data.method||'bank_transfer', data.reference, data.notes, data.created_by],
      );
      const totPaid = await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1', [invoiceId]);
      const inv = await client.query('SELECT total_amount FROM invoices WHERE id=$1', [invoiceId]);
      const paid = Number(totPaid.rows[0].paid);
      const total = Number(inv.rows[0].total_amount);
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      await client.query('UPDATE invoices SET status=$1 WHERE id=$2', [status, invoiceId]);
      return pr.rows[0];
    });
  }
}
