import db from "../../config/database.js";

export async function findUserByEmail(email) {
  const res = await db.query(
    "SELECT id, name, email, password, role FROM users WHERE email=$1 AND is_active=TRUE",
    [email]
  );
  return res.rows[0];
}

export async function findUserById(id) {
  const res = await db.query(
    "SELECT id, name, email, role, is_active, created_at FROM users WHERE id=$1",
    [id]
  );
  return res.rows[0];
}

export async function createUser({ name, email, password, role = "Agent" }) {
  const res = await db.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role",
    [name, email, password, role]
  );
  return res.rows[0];
}

export async function listUsers() {
  const res = await db.query(
    "SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  return res.rows;
}

export async function updateUser(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (fields.name !== undefined)      { sets.push(`name=$${i++}`);      vals.push(fields.name); }
  if (fields.role !== undefined)      { sets.push(`role=$${i++}`);      vals.push(fields.role); }
  if (fields.is_active !== undefined) { sets.push(`is_active=$${i++}`); vals.push(fields.is_active); }
  if (!sets.length) return null;
  sets.push(`updated_at=NOW()`);
  vals.push(id);
  const res = await db.query(
    `UPDATE users SET ${sets.join(",")} WHERE id=$${i} RETURNING id,name,email,role,is_active`,
    vals
  );
  return res.rows[0];
}
