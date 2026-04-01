import db from "../../config/database.js";

// ─── Vendors ──────────────────────────────────────────────
export async function listVendors(search) {
  const vals = search ? [`%${search}%`] : [];
  const where = search ? "WHERE name ILIKE $1 OR email ILIKE $1" : "";
  const res = await db.query(`SELECT * FROM vendors ${where} ORDER BY name`, vals);
  return res.rows;
}
export async function getVendor(id) {
  const res = await db.query("SELECT * FROM vendors WHERE id=$1", [id]);
  return res.rows[0];
}
export async function createVendor(data) {
  const { name, email, phone, gstin, address } = data;
  const res = await db.query(
    "INSERT INTO vendors (name,email,phone,gstin,address) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [name, email, phone, gstin, address]
  );
  return res.rows[0];
}
export async function updateVendor(id, data) {
  const fields = ["name","email","phone","gstin","address","is_active"];
  const sets=[]; const vals=[]; let i=1;
  for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
  if (!sets.length) return null;
  vals.push(id);
  const res = await db.query(`UPDATE vendors SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
  return res.rows[0];
}

// ─── Purchase Orders ──────────────────────────────────────
export async function listPOs() {
  const res = await db.query(
    `SELECT po.*, v.name AS vendor_name FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id ORDER BY po.created_at DESC`
  );
  return res.rows;
}
export async function getPO(id) {
  const [po, items] = await Promise.all([
    db.query(`SELECT po.*,v.name AS vendor_name FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id WHERE po.id=$1`, [id]),
    db.query("SELECT poi.*,p.name AS product_name FROM purchase_order_items poi JOIN products p ON p.id=poi.product_id WHERE poi.po_id=$1", [id]),
  ]);
  if (!po.rows[0]) return null;
  return { ...po.rows[0], items: items.rows };
}
export async function createPO(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const total = items.reduce((s,i) => s + Number(i.total), 0);
    const pn = `PO-${Date.now()}`;
    const pr = await client.query(
      "INSERT INTO purchase_orders (po_number,vendor_id,status,order_date,expected_date,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [pn, data.vendor_id, "draft", data.order_date || new Date().toISOString().split("T")[0], data.expected_date, data.notes, total, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO purchase_order_items (po_id,product_id,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6)",
        [pr.rows[0].id, it.product_id, it.quantity, it.unit_price, it.gst_rate||0, it.total]
      );
    }
    await client.query("COMMIT");
    return pr.rows[0];
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
export async function updatePOStatus(id, status) {
  const res = await db.query("UPDATE purchase_orders SET status=$1 WHERE id=$2 RETURNING *", [status, id]);
  return res.rows[0];
}

// ─── GRN ──────────────────────────────────────────────────
export async function listGRNs() {
  const res = await db.query(
    `SELECT g.*, po.po_number, v.name AS vendor_name FROM grn g
     JOIN purchase_orders po ON po.id = g.po_id
     JOIN vendors v ON v.id = po.vendor_id
     ORDER BY g.received_at DESC`
  );
  return res.rows;
}
export async function getGRN(id) {
  const [g, items] = await Promise.all([
    db.query(`SELECT g.*,po.po_number FROM grn g JOIN purchase_orders po ON po.id=g.po_id WHERE g.id=$1`, [id]),
    db.query("SELECT gi.*,p.name AS product_name,w.name AS warehouse_name FROM grn_items gi JOIN products p ON p.id=gi.product_id JOIN warehouses w ON w.id=gi.warehouse_id WHERE gi.grn_id=$1", [id]),
  ]);
  if (!g.rows[0]) return null;
  return { ...g.rows[0], items: items.rows };
}
export async function createGRN(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const gn = `GRN-${Date.now()}`;
    const gr = await client.query(
      "INSERT INTO grn (grn_number,po_id,notes,created_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [gn, data.po_id, data.notes, data.created_by]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO grn_items (grn_id,product_id,quantity,warehouse_id) VALUES ($1,$2,$3,$4)",
        [gr.rows[0].id, it.product_id, it.quantity, it.warehouse_id]
      );
      // Update stock
      await client.query(
        `INSERT INTO stock (product_id,warehouse_id,quantity) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity = stock.quantity + $3, updated_at=NOW()`,
        [it.product_id, it.warehouse_id, it.quantity]
      );
      await client.query(
        "INSERT INTO stock_movements (product_id,warehouse_id,type,quantity,reference,created_by) VALUES ($1,$2,'in',$3,$4,$5)",
        [it.product_id, it.warehouse_id, it.quantity, gn, data.created_by]
      );
    }
    // Mark PO as received
    await client.query("UPDATE purchase_orders SET status='received' WHERE id=$1", [data.po_id]);
    await client.query("COMMIT");
    return gr.rows[0];
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ─── Purchase Invoices ────────────────────────────────────
export async function listPurchaseInvoices() {
  const res = await db.query(
    `SELECT pi.*,v.name AS vendor_name FROM purchase_invoices pi
     JOIN vendors v ON v.id = pi.vendor_id ORDER BY pi.created_at DESC`
  );
  return res.rows;
}
export async function createPurchaseInvoice(data) {
  const res = await db.query(
    "INSERT INTO purchase_invoices (invoice_number,vendor_id,po_id,invoice_date,due_date,amount,gst_amount,total_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [data.invoice_number, data.vendor_id, data.po_id, data.invoice_date, data.due_date, data.amount, data.gst_amount||0, data.total_amount]
  );
  return res.rows[0];
}
