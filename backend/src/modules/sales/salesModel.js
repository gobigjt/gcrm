import db from "../../config/database.js";

// ─── Customers ────────────────────────────────────────────
export async function listCustomers(search) {
  const vals = search ? [`%${search}%`] : [];
  const where = search ? "WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1" : "";
  const res = await db.query(`SELECT * FROM customers ${where} ORDER BY name`, vals);
  return res.rows;
}
export async function getCustomer(id) {
  const res = await db.query("SELECT * FROM customers WHERE id=$1", [id]);
  return res.rows[0];
}
export async function createCustomer(data) {
  const { name, email, phone, gstin, address, lead_id } = data;
  const res = await db.query(
    "INSERT INTO customers (name,email,phone,gstin,address,lead_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [name, email, phone, gstin, address, lead_id]
  );
  return res.rows[0];
}
export async function updateCustomer(id, data) {
  const fields = ["name","email","phone","gstin","address","is_active"];
  const sets = []; const vals = []; let i = 1;
  for (const f of fields) { if (data[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
  if (!sets.length) return null;
  vals.push(id);
  const res = await db.query(`UPDATE customers SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
  return res.rows[0];
}

// ─── Proposals ────────────────────────────────────────────
export async function listProposals() {
  const res = await db.query(
    `SELECT p.*, c.name AS customer_name FROM proposals p
     JOIN customers c ON c.id = p.customer_id ORDER BY p.created_at DESC`
  );
  return res.rows;
}
export async function getProposal(id) {
  const [p, items] = await Promise.all([
    db.query(`SELECT p.*,c.name AS customer_name FROM proposals p JOIN customers c ON c.id=p.customer_id WHERE p.id=$1`, [id]),
    db.query("SELECT pi.*, pr.name AS product_name FROM proposal_items pi LEFT JOIN products pr ON pr.id=pi.product_id WHERE pi.proposal_id=$1", [id]),
  ]);
  if (!p.rows[0]) return null;
  return { ...p.rows[0], items: items.rows };
}
export async function createProposal(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const total = items.reduce((s, i) => s + Number(i.total), 0);
    const pn = `PROP-${Date.now()}`;
    const pr = await client.query(
      "INSERT INTO proposals (proposal_number,customer_id,lead_id,status,valid_until,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [pn, data.customer_id, data.lead_id, data.status || "draft", data.valid_until, data.notes, total, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO proposal_items (proposal_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [pr.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate || 0, it.total]
      );
    }
    await client.query("COMMIT");
    return pr.rows[0];
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
export async function updateProposalStatus(id, status) {
  const res = await db.query("UPDATE proposals SET status=$1 WHERE id=$2 RETURNING *", [status, id]);
  return res.rows[0];
}

// ─── Quotations ───────────────────────────────────────────
export async function listQuotations() {
  const res = await db.query(
    `SELECT q.*, c.name AS customer_name FROM quotations q
     JOIN customers c ON c.id = q.customer_id ORDER BY q.created_at DESC`
  );
  return res.rows;
}
export async function getQuotation(id) {
  const [q, items] = await Promise.all([
    db.query(
      `SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.gstin AS customer_gstin, c.address AS customer_address
         FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=$1`,
      [id],
    ),
    db.query(
      `SELECT qi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
         FROM quotation_items qi LEFT JOIN products pr ON pr.id=qi.product_id WHERE qi.quotation_id=$1`,
      [id],
    ),
  ]);
  if (!q.rows[0]) return null;
  return { ...q.rows[0], items: items.rows };
}
export async function createQuotation(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const total = items.reduce((s, i) => s + Number(i.total), 0);
    const qn = `QUOT-${Date.now()}`;
    const qr = await client.query(
      "INSERT INTO quotations (quotation_number,customer_id,proposal_id,status,valid_until,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [qn, data.customer_id, data.proposal_id, data.status || "draft", data.valid_until, data.notes, total, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [qr.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate || 0, it.total]
      );
    }
    await client.query("COMMIT");
    return qr.rows[0];
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ─── Sales Orders ─────────────────────────────────────────
export async function listOrders() {
  const res = await db.query(
    `SELECT o.*, c.name AS customer_name FROM sales_orders o
     JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC`
  );
  return res.rows;
}
export async function getOrder(id) {
  const [o, items] = await Promise.all([
    db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.gstin AS customer_gstin, c.address AS customer_address
         FROM sales_orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`,
      [id],
    ),
    db.query(
      `SELECT oi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
         FROM sales_order_items oi LEFT JOIN products pr ON pr.id=oi.product_id WHERE oi.order_id=$1`,
      [id],
    ),
  ]);
  if (!o.rows[0]) return null;
  return { ...o.rows[0], items: items.rows };
}
export async function createOrder(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const total = items.reduce((s, i) => s + Number(i.total), 0);
    const on = `ORD-${Date.now()}`;
    const or = await client.query(
      "INSERT INTO sales_orders (order_number,customer_id,quotation_id,status,order_date,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [on, data.customer_id, data.quotation_id, data.status || "pending", data.order_date || new Date().toISOString().split("T")[0], data.notes, total, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [or.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate || 0, it.total]
      );
    }
    await client.query("COMMIT");
    return or.rows[0];
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
export async function updateOrderStatus(id, status) {
  const res = await db.query("UPDATE sales_orders SET status=$1 WHERE id=$2 RETURNING *", [status, id]);
  return res.rows[0];
}

// ─── Invoices ─────────────────────────────────────────────
export async function listInvoices() {
  const res = await db.query(
    `SELECT i.*, c.name AS customer_name FROM invoices i
     JOIN customers c ON c.id = i.customer_id ORDER BY i.created_at DESC`
  );
  return res.rows;
}
export async function getInvoice(id) {
  const [inv, items, pays] = await Promise.all([
    db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.gstin AS customer_gstin, c.address AS customer_address
         FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=$1`,
      [id],
    ),
    db.query(
      `SELECT ii.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
         FROM invoice_items ii LEFT JOIN products pr ON pr.id=ii.product_id WHERE ii.invoice_id=$1`,
      [id],
    ),
    db.query("SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date", [id]),
  ]);
  if (!inv.rows[0]) return null;
  return { ...inv.rows[0], items: items.rows, payments: pays.rows };
}
export async function createInvoice(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    for (const it of items) {
      subtotal += Number(it.unit_price) * Number(it.quantity);
      if (data.is_interstate) igst += Number(it.igst || 0);
      else { cgst += Number(it.cgst || 0); sgst += Number(it.sgst || 0); }
    }
    const total = subtotal + cgst + sgst + igst;
    const inv_no = `INV-${Date.now()}`;
    const ir = await client.query(
      "INSERT INTO invoices (invoice_number,customer_id,order_id,invoice_date,due_date,subtotal,cgst,sgst,igst,total_amount,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [inv_no, data.customer_id, data.order_id, data.invoice_date || new Date().toISOString().split("T")[0], data.due_date, subtotal, cgst, sgst, igst, total, data.notes, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [ir.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate || 0, it.cgst || 0, it.sgst || 0, it.igst || 0, it.total]
      );
    }
    await client.query("COMMIT");
    return ir.rows[0];
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ─── Payments ─────────────────────────────────────────────
export async function addPayment({ invoice_id, amount, payment_date, method, reference, notes, created_by }) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const pr = await client.query(
      "INSERT INTO payments (invoice_id,amount,payment_date,method,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [invoice_id, amount, payment_date || new Date().toISOString().split("T")[0], method || "bank_transfer", reference, notes, created_by]
    );
    // Update invoice status
    const totPaid = await client.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1", [invoice_id]);
    const inv = await client.query("SELECT total_amount FROM invoices WHERE id=$1", [invoice_id]);
    const paid = Number(totPaid.rows[0].paid);
    const total = Number(inv.rows[0].total_amount);
    const status = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
    await client.query("UPDATE invoices SET status=$1 WHERE id=$2", [status, invoice_id]);
    await client.query("COMMIT");
    return pr.rows[0];
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
