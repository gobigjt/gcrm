import db from "../../config/database.js";

// ─── Products ─────────────────────────────────────────────
export async function listProducts(search) {
  const vals = search ? [`%${search}%`] : [];
  const where = search ? "WHERE name ILIKE $1 OR sku ILIKE $1 OR hsn_code ILIKE $1" : "";
  const res = await db.query(`SELECT * FROM products ${where} ORDER BY name`, vals);
  return res.rows;
}
export async function getProduct(id) {
  const res = await db.query("SELECT * FROM products WHERE id=$1", [id]);
  return res.rows[0];
}
export async function createProduct(data) {
  const { name, sku, hsn_code, description, unit, purchase_price, sale_price, gst_rate, low_stock_alert } = data;
  const res = await db.query(
    "INSERT INTO products (name,sku,hsn_code,description,unit,purchase_price,sale_price,gst_rate,low_stock_alert) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [name, sku, hsn_code, description, unit||"pcs", purchase_price||0, sale_price||0, gst_rate||0, low_stock_alert||0]
  );
  return res.rows[0];
}
export async function updateProduct(id, data) {
  const fields = ["name","sku","hsn_code","description","unit","purchase_price","sale_price","gst_rate","low_stock_alert","is_active"];
  const sets=[]; const vals=[]; let i=1;
  for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
  if (!sets.length) return null;
  vals.push(id);
  const res = await db.query(`UPDATE products SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
  return res.rows[0];
}

// ─── Warehouses ───────────────────────────────────────────
export async function listWarehouses() {
  const res = await db.query("SELECT * FROM warehouses ORDER BY name");
  return res.rows;
}
export async function createWarehouse(data) {
  const res = await db.query(
    "INSERT INTO warehouses (name,location) VALUES ($1,$2) RETURNING *",
    [data.name, data.location]
  );
  return res.rows[0];
}

// ─── Stock ────────────────────────────────────────────────
export async function getStock(product_id) {
  const res = await db.query(
    `SELECT s.*,w.name AS warehouse_name FROM stock s
     JOIN warehouses w ON w.id = s.warehouse_id
     WHERE s.product_id=$1`,
    [product_id]
  );
  return res.rows;
}
export async function listLowStock() {
  const res = await db.query(
    `SELECT p.name, p.sku, p.low_stock_alert, COALESCE(SUM(s.quantity),0) AS total_stock
     FROM products p
     LEFT JOIN stock s ON s.product_id = p.id
     GROUP BY p.id
     HAVING COALESCE(SUM(s.quantity),0) <= p.low_stock_alert AND p.low_stock_alert > 0
     ORDER BY total_stock ASC`
  );
  return res.rows;
}

// ─── Stock Adjustment ─────────────────────────────────────
export async function adjustStock({ product_id, warehouse_id, type, quantity, note, created_by }) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const delta = type === "out" ? -Math.abs(quantity) : Math.abs(quantity);
    await client.query(
      `INSERT INTO stock (product_id,warehouse_id,quantity) VALUES ($1,$2,$3)
       ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity = stock.quantity + $3, updated_at=NOW()`,
      [product_id, warehouse_id, delta]
    );
    await client.query(
      "INSERT INTO stock_movements (product_id,warehouse_id,type,quantity,note,created_by) VALUES ($1,$2,$3,$4,$5,$6)",
      [product_id, warehouse_id, type, Math.abs(quantity), note, created_by]
    );
    await client.query("COMMIT");
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

export async function listMovements(product_id) {
  const cond = product_id ? "WHERE sm.product_id=$1" : "";
  const vals = product_id ? [product_id] : [];
  const res = await db.query(
    `SELECT sm.*,p.name AS product_name,w.name AS warehouse_name FROM stock_movements sm
     JOIN products p ON p.id=sm.product_id JOIN warehouses w ON w.id=sm.warehouse_id
     ${cond} ORDER BY sm.created_at DESC LIMIT 200`,
    vals
  );
  return res.rows;
}
