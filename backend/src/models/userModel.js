import db from "../config/database.js";

export async function findUserByEmail(email) {
  const res = await db.query("SELECT id, name, email, password, role FROM users WHERE email=$1", [email]);
  return res.rows[0];
}

export async function createUser({ name, email, password, role = "Agent" }) {
  const res = await db.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role",
    [name, email, password, role]
  );
  return res.rows[0];
}
