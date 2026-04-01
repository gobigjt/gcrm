import db from "../../config/database.js";

// ─── Leads ────────────────────────────────────────────────
export async function listLeads({ stage_id, source_id, assigned_to, search } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;
  if (stage_id)    { conditions.push(`l.stage_id=$${i++}`);    vals.push(stage_id); }
  if (source_id)   { conditions.push(`l.source_id=$${i++}`);   vals.push(source_id); }
  if (assigned_to) { conditions.push(`l.assigned_to=$${i++}`); vals.push(assigned_to); }
  if (search)      { conditions.push(`(l.name ILIKE $${i} OR l.email ILIKE $${i} OR l.company ILIKE $${i})`); vals.push(`%${search}%`); i++; }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT l.*, ls.name AS stage, s.name AS source, u.name AS assigned_name
     FROM leads l
     LEFT JOIN lead_stages ls ON ls.id = l.stage_id
     LEFT JOIN lead_sources s ON s.id = l.source_id
     LEFT JOIN users u ON u.id = l.assigned_to
     ${where}
     ORDER BY l.created_at DESC`,
    vals
  );
  return res.rows;
}

export async function getLead(id) {
  const res = await db.query(
    `SELECT l.*, ls.name AS stage, s.name AS source, u.name AS assigned_name
     FROM leads l
     LEFT JOIN lead_stages ls ON ls.id = l.stage_id
     LEFT JOIN lead_sources s ON s.id = l.source_id
     LEFT JOIN users u ON u.id = l.assigned_to
     WHERE l.id=$1`,
    [id]
  );
  return res.rows[0];
}

export async function createLead(data) {
  const { name, email, phone, company, source_id, stage_id, assigned_to, notes, custom_fields } = data;
  const res = await db.query(
    `INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [name, email, phone, company, source_id, stage_id, assigned_to, notes, custom_fields ? JSON.stringify(custom_fields) : null]
  );
  return res.rows[0];
}

export async function updateLead(id, data) {
  const fields = ["name","email","phone","company","source_id","stage_id","assigned_to","notes","custom_fields","is_converted"];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const f of fields) {
    if (data[f] !== undefined) {
      sets.push(`${f}=$${i++}`);
      vals.push(f === "custom_fields" ? JSON.stringify(data[f]) : data[f]);
    }
  }
  if (!sets.length) return null;
  sets.push("updated_at=NOW()");
  vals.push(id);
  const res = await db.query(
    `UPDATE leads SET ${sets.join(",")} WHERE id=$${i} RETURNING *`,
    vals
  );
  return res.rows[0];
}

export async function deleteLead(id) {
  await db.query("DELETE FROM leads WHERE id=$1", [id]);
}

// ─── Stages & Sources ─────────────────────────────────────
export async function listStages() {
  const res = await db.query("SELECT * FROM lead_stages ORDER BY position");
  return res.rows;
}

export async function listSources() {
  const res = await db.query("SELECT * FROM lead_sources ORDER BY name");
  return res.rows;
}

// ─── Activities ───────────────────────────────────────────
export async function listActivities(lead_id) {
  const res = await db.query(
    `SELECT a.*, u.name AS user_name FROM lead_activities a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.lead_id=$1 ORDER BY a.created_at DESC`,
    [lead_id]
  );
  return res.rows;
}

export async function createActivity({ lead_id, user_id, type, description }) {
  const res = await db.query(
    "INSERT INTO lead_activities (lead_id,user_id,type,description) VALUES ($1,$2,$3,$4) RETURNING *",
    [lead_id, user_id, type, description]
  );
  return res.rows[0];
}

// ─── Follow-ups ────────────────────────────────────────────
export async function listFollowups(lead_id) {
  const res = await db.query(
    `SELECT f.*, u.name AS assigned_name FROM lead_followups f
     LEFT JOIN users u ON u.id = f.assigned_to
     WHERE f.lead_id=$1 ORDER BY f.due_date ASC`,
    [lead_id]
  );
  return res.rows;
}

export async function createFollowup({ lead_id, assigned_to, due_date, description }) {
  const res = await db.query(
    "INSERT INTO lead_followups (lead_id,assigned_to,due_date,description) VALUES ($1,$2,$3,$4) RETURNING *",
    [lead_id, assigned_to, due_date, description]
  );
  return res.rows[0];
}

export async function updateFollowup(id, { is_done }) {
  const res = await db.query(
    "UPDATE lead_followups SET is_done=$1 WHERE id=$2 RETURNING *",
    [is_done, id]
  );
  return res.rows[0];
}
