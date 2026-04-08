import db from "../../config/database.js";

export async function getCompanySettings() {
  const res = await db.query("SELECT * FROM company_settings LIMIT 1");
  return res.rows[0];
}
export async function upsertCompanySettings(data) {
  const existing = await getCompanySettings();
  if (existing) {
    const fields = ["company_name","gstin","address","phone","email","logo_url","currency","fiscal_year_start","invoice_tagline","payment_terms","invoice_bank_details","bank_name","bank_branch","bank_account_number","bank_ifsc"];
    const sets=[]; const vals=[]; let i=1;
    for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
    sets.push("updated_at=NOW()");
    vals.push(existing.id);
    const res = await db.query(`UPDATE company_settings SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
    return res.rows[0];
  } else {
    const res = await db.query(
      "INSERT INTO company_settings (company_name,gstin,address,phone,email,logo_url,currency,fiscal_year_start,invoice_tagline,payment_terms,invoice_bank_details,bank_name,bank_branch,bank_account_number,bank_ifsc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
      [data.company_name||"My Company", data.gstin, data.address, data.phone, data.email, data.logo_url, data.currency||"INR", data.fiscal_year_start, data.invoice_tagline, data.payment_terms, data.invoice_bank_details, data.bank_name, data.bank_branch, data.bank_account_number, data.bank_ifsc]
    );
    return res.rows[0];
  }
}

export async function listPermissions() {
  const res = await db.query("SELECT * FROM roles_permissions ORDER BY role,module");
  return res.rows;
}
export async function upsertPermission({ role, module, can_read, can_write, can_delete }) {
  const res = await db.query(
    `INSERT INTO roles_permissions (role,module,can_read,can_write,can_delete) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (role,module) DO UPDATE SET can_read=$3,can_write=$4,can_delete=$5 RETURNING *`,
    [role, module, can_read??true, can_write??false, can_delete??false]
  );
  return res.rows[0];
}

export async function getAuditLogs({ module, user_id } = {}) {
  const conds=[]; const vals=[]; let i=1;
  if(module)  { conds.push(`module=$${i++}`);  vals.push(module); }
  if(user_id) { conds.push(`user_id=$${i++}`); vals.push(user_id); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT al.*,u.name AS user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ${where} ORDER BY al.created_at DESC LIMIT 500`,
    vals
  );
  return res.rows;
}
export async function addAuditLog({ user_id, action, module, record_id, details, ip_address }) {
  await db.query(
    "INSERT INTO audit_logs (user_id,action,module,record_id,details,ip_address) VALUES ($1,$2,$3,$4,$5,$6)",
    [user_id, action, module, record_id, details ? JSON.stringify(details) : null, ip_address]
  );
}
