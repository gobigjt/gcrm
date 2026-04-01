import db from "../../config/database.js";

export async function listTemplates() {
  const res = await db.query("SELECT * FROM comm_templates ORDER BY channel,name");
  return res.rows;
}
export async function createTemplate(data) {
  const res = await db.query(
    "INSERT INTO comm_templates (name,channel,subject,body) VALUES ($1,$2,$3,$4) RETURNING *",
    [data.name, data.channel, data.subject, data.body]
  );
  return res.rows[0];
}
export async function updateTemplate(id, data) {
  const res = await db.query(
    "UPDATE comm_templates SET name=$1,channel=$2,subject=$3,body=$4 WHERE id=$5 RETURNING *",
    [data.name, data.channel, data.subject, data.body, id]
  );
  return res.rows[0];
}
export async function deleteTemplate(id) {
  await db.query("DELETE FROM comm_templates WHERE id=$1", [id]);
}

export async function listLogs({ lead_id, channel } = {}) {
  const conds=[]; const vals=[]; let i=1;
  if(lead_id)  { conds.push(`lead_id=$${i++}`);  vals.push(lead_id); }
  if(channel)  { conds.push(`channel=$${i++}`);   vals.push(channel); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT cl.*,u.name AS sent_by_name FROM comm_logs cl
     LEFT JOIN users u ON u.id=cl.sent_by ${where} ORDER BY cl.sent_at DESC`,
    vals
  );
  return res.rows;
}
export async function createLog(data) {
  const res = await db.query(
    "INSERT INTO comm_logs (lead_id,channel,recipient,subject,body,status,sent_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [data.lead_id, data.channel, data.recipient, data.subject, data.body, data.status||"sent", data.sent_by]
  );
  return res.rows[0];
}
