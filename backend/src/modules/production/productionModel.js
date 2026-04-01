import db from "../../config/database.js";

// ─── BOM ──────────────────────────────────────────────────
export async function listBOMs() {
  const res = await db.query(
    `SELECT b.*,p.name AS product_name FROM bom b JOIN products p ON p.id=b.product_id ORDER BY b.created_at DESC`
  );
  return res.rows;
}
export async function getBOM(id) {
  const [b, items] = await Promise.all([
    db.query(`SELECT b.*,p.name AS product_name FROM bom b JOIN products p ON p.id=b.product_id WHERE b.id=$1`, [id]),
    db.query("SELECT bi.*,p.name AS component_name FROM bom_items bi JOIN products p ON p.id=bi.component_id WHERE bi.bom_id=$1", [id]),
  ]);
  if (!b.rows[0]) return null;
  return { ...b.rows[0], items: items.rows };
}
export async function createBOM(data, items) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const br = await client.query(
      "INSERT INTO bom (product_id,name,version) VALUES ($1,$2,$3) RETURNING *",
      [data.product_id, data.name, data.version||"1.0"]
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO bom_items (bom_id,component_id,quantity,unit) VALUES ($1,$2,$3,$4)",
        [br.rows[0].id, it.component_id, it.quantity, it.unit||"pcs"]
      );
    }
    await client.query("COMMIT");
    return br.rows[0];
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ─── Work Orders ──────────────────────────────────────────
export async function listWorkOrders(status) {
  const where = status ? "WHERE wo.status=$1" : "";
  const vals = status ? [status] : [];
  const res = await db.query(
    `SELECT wo.*,p.name AS product_name FROM work_orders wo JOIN products p ON p.id=wo.product_id ${where} ORDER BY wo.created_at DESC`,
    vals
  );
  return res.rows;
}
export async function getWorkOrder(id) {
  const res = await db.query(
    `SELECT wo.*,p.name AS product_name,b.name AS bom_name FROM work_orders wo
     JOIN products p ON p.id=wo.product_id LEFT JOIN bom b ON b.id=wo.bom_id WHERE wo.id=$1`,
    [id]
  );
  return res.rows[0];
}
export async function createWorkOrder(data) {
  const wn = `WO-${Date.now()}`;
  const res = await db.query(
    "INSERT INTO work_orders (wo_number,product_id,bom_id,quantity,status,planned_start,planned_end,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [wn, data.product_id, data.bom_id, data.quantity, "planned", data.planned_start, data.planned_end, data.notes, data.created_by]
  );
  return res.rows[0];
}
export async function updateWorkOrder(id, data) {
  const fields = ["status","actual_start","actual_end","notes"];
  const sets=[]; const vals=[]; let i=1;
  for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
  if (!sets.length) return null;
  vals.push(id);
  const res = await db.query(`UPDATE work_orders SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
  return res.rows[0];
}
