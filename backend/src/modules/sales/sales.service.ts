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

  /** Active users who can own quotes/orders/invoices (sales module filters). */
  async listSalesExecutives() {
    return (
      await this.db.query(
        `SELECT DISTINCT u.id, u.name
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.is_active = TRUE
           AND r.name IN ('Sales Executive', 'Sales Manager', 'Admin', 'Super Admin')
         ORDER BY u.name`,
      )
    ).rows;
  }

  /** Whether this user may be stored as document owner (created_by). */
  private async isAssignableSalesUser(userId: number): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM users u
       INNER JOIN roles ro ON ro.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE
         AND ro.name IN ('Sales Executive', 'Sales Manager', 'Admin', 'Super Admin')
       LIMIT 1`,
      [userId],
    );
    return r.rows.length > 0;
  }

  /**
   * Pick `created_by` for a new/patched sales document.
   * Admins / Super Admins / Sales Managers may assign another sales user; others always self.
   */
  async resolveDocumentCreatedBy(actor: { id: number; role?: string }, requested: unknown): Promise<number> {
    const self = Number(actor.id);
    if (requested === undefined || requested === null || requested === '') return self;
    const rid = Number(requested);
    if (!Number.isFinite(rid) || rid <= 0) return self;
    if (rid === self) return self;
    const assignerRoles = new Set(['Admin', 'Super Admin', 'Sales Manager']);
    if (!assignerRoles.has(String(actor.role || ''))) return self;
    const ok = await this.isAssignableSalesUser(rid);
    return ok ? rid : self;
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
  async listQuotations(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`q.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`q.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`q.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`q.created_at>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`q.created_at<=$${n++}`);
      vals.push(`${filters.to} 23:59:59`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT q.*, c.name AS customer_name, u.name AS created_by_name
         FROM quotations q
         JOIN customers c ON c.id=q.customer_id
         LEFT JOIN users u ON u.id=q.created_by
         ${where} ORDER BY q.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getQuotation(id: number) {
    const [q, items] = await Promise.all([
      this.db.query(
        `SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM quotations q
           JOIN customers c ON c.id=q.customer_id
           LEFT JOIN users cu ON cu.id=q.created_by
           WHERE q.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT qi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM quotation_items qi LEFT JOIN products pr ON pr.id=qi.product_id WHERE qi.quotation_id=$1`,
        [id],
      ),
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
  async listOrders(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`o.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`o.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`o.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`o.order_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`o.order_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT o.*, c.name AS customer_name, u.name AS created_by_name
         FROM sales_orders o
         JOIN customers c ON c.id=o.customer_id
         LEFT JOIN users u ON u.id=o.created_by
         ${where} ORDER BY o.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getOrder(id: number) {
    const [o, items] = await Promise.all([
      this.db.query(
        `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM sales_orders o
           JOIN customers c ON c.id=o.customer_id
           LEFT JOIN users cu ON cu.id=o.created_by
           WHERE o.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT oi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM sales_order_items oi LEFT JOIN products pr ON pr.id=oi.product_id WHERE oi.order_id=$1`,
        [id],
      ),
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
  async patchOrder(id: number, b: any) {
    if (typeof b === 'string') {
      return (await this.db.query('UPDATE sales_orders SET status=$1 WHERE id=$2 RETURNING *', [b, id])).rows[0];
    }
    if (b?.items !== undefined && Array.isArray(b.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM sales_orders WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM sales_order_items WHERE order_id=$1', [id]);
        let sum = 0;
        for (const it of b.items) {
          const lineTotal = Number(it.total ?? 0);
          sum += lineTotal;
          await client.query(
            'INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [
              id,
              it.product_id ?? null,
              String(it.description ?? ''),
              Number(it.quantity),
              Number(it.unit_price),
              Number(it.gst_rate ?? 0),
              lineTotal,
            ],
          );
        }
        const sets = ['total_amount = $1'];
        const vals: any[] = [sum];
        let n = 2;
        if (b.customer_id !== undefined) {
          sets.push(`customer_id=$${n++}`);
          vals.push(b.customer_id);
        }
        if (b.order_date !== undefined) {
          sets.push(`order_date=$${n++}`);
          vals.push(b.order_date);
        }
        if (b.due_date !== undefined) {
          sets.push(`due_date=$${n++}`);
          vals.push(b.due_date);
        }
        if (b.notes !== undefined) {
          sets.push(`notes=$${n++}`);
          vals.push(b.notes);
        }
        if (b.status !== undefined) {
          sets.push(`status=$${n++}`);
          vals.push(b.status);
        }
        if (b.created_by !== undefined) {
          sets.push(`created_by=$${n++}`);
          vals.push(b.created_by);
        }
        vals.push(id);
        await client.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getOrder(id);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) {
      sets.push(`status=$${n++}`);
      vals.push(b.status);
    }
    if (b?.notes !== undefined) {
      sets.push(`notes=$${n++}`);
      vals.push(b.notes);
    }
    if (b?.order_date !== undefined) {
      sets.push(`order_date=$${n++}`);
      vals.push(b.order_date);
    }
    if (b?.due_date !== undefined) {
      sets.push(`due_date=$${n++}`);
      vals.push(b.due_date);
    }
    if (b?.customer_id !== undefined) {
      sets.push(`customer_id=$${n++}`);
      vals.push(b.customer_id);
    }
    if (b?.created_by !== undefined) {
      sets.push(`created_by=$${n++}`);
      vals.push(b.created_by);
    }
    if (!sets.length) {
      return (await this.db.query('SELECT * FROM sales_orders WHERE id=$1', [id])).rows[0];
    }
    vals.push(id);
    return (await this.db.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n} RETURNING *`, vals)).rows[0];
  }

  // ─── Invoices ─────────────────────────────────────────────
  async listInvoices(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`i.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`i.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`i.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`i.invoice_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`i.invoice_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin,
                u.name AS created_by_name,
                COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) AS paid_amount,
                i.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) AS balance
         FROM invoices i
         JOIN customers c ON c.id=i.customer_id
         LEFT JOIN users u ON u.id=i.created_by
         ${where} ORDER BY i.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getInvoice(id: number) {
    const [inv, items, pays] = await Promise.all([
      this.db.query(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM invoices i
           JOIN customers c ON c.id=i.customer_id
           LEFT JOIN users cu ON cu.id=i.created_by
           WHERE i.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT ii.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM invoice_items ii LEFT JOIN products pr ON pr.id=ii.product_id WHERE ii.invoice_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return inv.rows[0] ? { ...inv.rows[0], items: items.rows, payments: pays.rows } : null;
  }
  async createInvoice(data: any, items: any[]) {
    const row = await this.db.transaction(async (client) => {
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
    await this.cache.del('dashboard:stats');
    return row;
  }
  async stats() {
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int        FROM customers  WHERE is_active=TRUE)                                    AS customers,
        (SELECT COUNT(*)::int        FROM sales_orders WHERE status NOT IN ('delivered','cancelled'))          AS open_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                              AS revenue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial'))             AS receivable,
        (SELECT COUNT(*)::int        FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW()) AS overdue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices)                                                  AS total_sales,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                              AS paid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='unpaid')                            AS unpaid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='partial')                           AS partial_amount
    `);
    const r = res.rows[0];
    return {
      customers: r.customers,
      open_orders: r.open_orders,
      revenue: Number(r.revenue),
      receivable: Number(r.receivable),
      overdue: r.overdue,
      total_sales: Number(r.total_sales),
      paid_amount: Number(r.paid_amount),
      unpaid_amount: Number(r.unpaid_amount),
      partial_amount: Number(r.partial_amount),
    };
  }

  // ─── Payments (all invoice receipts) ──────────────────────
  async listPayments(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`i.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`p.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.from) {
      conds.push(`p.payment_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`p.payment_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT p.*, i.invoice_number, c.name AS customer_name, u.name AS created_by_name
         FROM payments p
         JOIN invoices i ON i.id=p.invoice_id
         JOIN customers c ON c.id=i.customer_id
         LEFT JOIN users u ON u.id=p.created_by
         ${where} ORDER BY p.payment_date DESC, p.created_at DESC`,
        vals,
      )
    ).rows;
  }

  // ─── Sale returns ─────────────────────────────────────────
  async listReturns(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`r.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`r.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.from) {
      conds.push(`r.return_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`r.return_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT r.*, c.name AS customer_name, u.name AS created_by_name,
                r.total_amount - r.paid_amount AS balance
         FROM sale_returns r
         JOIN customers c ON c.id=r.customer_id
         LEFT JOIN users u ON u.id=r.created_by
         ${where} ORDER BY r.created_at DESC`,
        vals,
      )
    ).rows;
  }

  async getReturn(id: number) {
    const [r, items, pays] = await Promise.all([
      this.db.query(
        `SELECT r.*, c.name AS customer_name FROM sale_returns r JOIN customers c ON c.id=r.customer_id WHERE r.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT ri.*, pr.name AS product_name FROM sale_return_items ri LEFT JOIN products pr ON pr.id=ri.product_id WHERE ri.return_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM sale_return_payments WHERE return_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return r.rows[0] ? { ...r.rows[0], items: items.rows, payments: pays.rows } : null;
  }

  async createReturn(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      for (const it of items) {
        const lineBase = Number(it.unit_price) * Number(it.quantity) - Number(it.discount || 0);
        subtotal += lineBase;
        cgst += Number(it.cgst || 0);
        sgst += Number(it.sgst || 0);
        igst += Number(it.igst || 0);
      }
      const discount = Number(data.discount_amount || 0);
      const roundOff = Number(data.round_off || 0);
      const total = subtotal + cgst + sgst + igst - discount + roundOff;
      const rn = `RET-${Date.now()}`;
      const rr = await client.query(
        `INSERT INTO sale_returns
          (return_number,customer_id,reference_no,return_date,state_of_supply,
           exchange_rate,notes,subtotal,cgst,sgst,igst,discount_amount,round_off,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          rn,
          data.customer_id,
          data.reference_no,
          data.return_date || new Date().toISOString().split('T')[0],
          data.state_of_supply,
          data.exchange_rate || 1,
          data.notes,
          subtotal,
          cgst,
          sgst,
          igst,
          discount,
          roundOff,
          total,
          data.created_by,
        ],
      );
      for (const it of items) {
        await client.query(
          'INSERT INTO sale_return_items (return_id,product_id,description,quantity,unit_price,discount,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            rr.rows[0].id,
            it.product_id,
            it.description,
            it.quantity,
            it.unit_price,
            it.discount || 0,
            it.gst_rate || 0,
            it.total,
          ],
        );
      }
      return rr.rows[0];
    });
  }

  async addReturnPayment(returnId: number, data: any) {
    return this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO sale_return_payments (return_id,amount,payment_date,method,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          returnId,
          data.amount,
          data.payment_date || new Date().toISOString().split('T')[0],
          data.method || 'bank_transfer',
          data.reference,
          data.notes,
          data.created_by,
        ],
      );
      const totPaid = await client.query(
        'SELECT COALESCE(SUM(amount),0) AS paid FROM sale_return_payments WHERE return_id=$1',
        [returnId],
      );
      await client.query('UPDATE sale_returns SET paid_amount=$1 WHERE id=$2', [Number(totPaid.rows[0].paid), returnId]);
      return pr.rows[0];
    });
  }

  async deleteReturn(id: number) {
    await this.db.query('DELETE FROM sale_returns WHERE id=$1', [id]);
  }

  async deleteCustomer(id: number)   { await this.db.query('DELETE FROM customers WHERE id=$1', [id]); await this.cache.delPattern('customers:*'); }
  async deleteQuotation(id: number)  { await this.db.query('DELETE FROM quotations WHERE id=$1', [id]); }
  async deleteOrder(id: number)      { await this.db.query('DELETE FROM sales_orders WHERE id=$1', [id]); }
  async deleteInvoice(id: number) {
    await this.db.query('DELETE FROM invoices WHERE id=$1', [id]);
    await this.cache.del('dashboard:stats');
  }

  /**
   * Partial update. If `items` is an array, line items are replaced and `total_amount` recalculated.
   * Optional fields: `status`, `notes`, `valid_until`, `customer_id`.
   */
  async patchQuotation(id: number, b: any) {
    if (b?.items !== undefined && Array.isArray(b.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM quotations WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM quotation_items WHERE quotation_id=$1', [id]);
        let sum = 0;
        for (const it of b.items) {
          const lineTotal = Number(it.total ?? 0);
          sum += lineTotal;
          await client.query(
            'INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [
              id,
              it.product_id ?? null,
              String(it.description ?? ''),
              Number(it.quantity),
              Number(it.unit_price),
              Number(it.gst_rate ?? 0),
              lineTotal,
            ],
          );
        }
        const sets = ['total_amount = $1'];
        const vals: any[] = [sum];
        let n = 2;
        if (b.customer_id !== undefined) {
          sets.push(`customer_id = $${n++}`);
          vals.push(b.customer_id);
        }
        if (b.valid_until !== undefined) {
          sets.push(`valid_until = $${n++}`);
          vals.push(b.valid_until);
        }
        if (b.notes !== undefined) {
          sets.push(`notes = $${n++}`);
          vals.push(b.notes);
        }
        if (b.status !== undefined) {
          sets.push(`status = $${n++}`);
          vals.push(b.status);
        }
        if (b.created_by !== undefined) {
          sets.push(`created_by = $${n++}`);
          vals.push(b.created_by);
        }
        vals.push(id);
        await client.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id = $${n}`, vals);
        return this.getQuotation(id);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) {
      sets.push(`status = $${n++}`);
      vals.push(b.status);
    }
    if (b?.notes !== undefined) {
      sets.push(`notes = $${n++}`);
      vals.push(b.notes);
    }
    if (b?.valid_until !== undefined) {
      sets.push(`valid_until = $${n++}`);
      vals.push(b.valid_until);
    }
    if (b?.customer_id !== undefined) {
      sets.push(`customer_id = $${n++}`);
      vals.push(b.customer_id);
    }
    if (b?.created_by !== undefined) {
      sets.push(`created_by = $${n++}`);
      vals.push(b.created_by);
    }
    if (!sets.length) return this.getQuotation(id);
    vals.push(id);
    await this.db.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id = $${n}`, vals);
    return this.getQuotation(id);
  }

  async patchInvoice(id: number, b: any) {
    if (b?.items !== undefined && Array.isArray(b.items)) {
      const row = await this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM invoices WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;

        await client.query('DELETE FROM invoice_items WHERE invoice_id=$1', [id]);

        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        for (const it of b.items) {
          const qty = Number(it.quantity ?? 0);
          const unit = Number(it.unit_price ?? 0);
          const rate = Number(it.gst_rate ?? 0);
          const base = qty * unit;
          const gst = base * rate / 100;
          const lineCgst = Number(it.cgst ?? (b.is_interstate ? 0 : gst / 2));
          const lineSgst = Number(it.sgst ?? (b.is_interstate ? 0 : gst / 2));
          const lineIgst = Number(it.igst ?? (b.is_interstate ? gst : 0));
          const lineTotal = Number(it.total ?? (base + lineCgst + lineSgst + lineIgst));

          subtotal += base;
          cgst += lineCgst;
          sgst += lineSgst;
          igst += lineIgst;

          await client.query(
            'INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [
              id,
              it.product_id ?? null,
              String(it.description ?? ''),
              qty,
              unit,
              rate,
              lineCgst,
              lineSgst,
              lineIgst,
              lineTotal,
            ],
          );
        }

        const total = subtotal + cgst + sgst + igst;
        const sets = ['subtotal=$1', 'cgst=$2', 'sgst=$3', 'igst=$4', 'total_amount=$5'];
        const vals: any[] = [subtotal, cgst, sgst, igst, total];
        let n = 6;
        if (b.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(b.customer_id); }
        if (b.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(b.invoice_date); }
        if (b.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(b.due_date); }
        if (b.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(b.notes); }
        if (b.status !== undefined) { sets.push(`status=$${n++}`); vals.push(b.status); }
        if (b.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(b.created_by); }
        vals.push(id);
        await client.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getInvoice(id);
      });
      await this.cache.del('dashboard:stats');
      return row;
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) { sets.push(`status=$${n++}`); vals.push(b.status); }
    if (b?.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(b.notes); }
    if (b?.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(b.invoice_date); }
    if (b?.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(b.due_date); }
    if (b?.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(b.customer_id); }
    if (b?.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(b.created_by); }
    if (!sets.length) return this.getInvoice(id);
    vals.push(id);
    await this.db.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
    await this.cache.del('dashboard:stats');
    return this.getInvoice(id);
  }

  async addPayment(invoiceId: number, data: any) {
    const row = await this.db.transaction(async (client) => {
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
    await this.cache.del('dashboard:stats');
    return row;
  }
}
