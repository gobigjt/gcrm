import db from "../../config/database.js";

// ─── Accounts ─────────────────────────────────────────────
export async function listAccounts() {
  const res = await db.query("SELECT * FROM accounts WHERE is_active=TRUE ORDER BY code");
  return res.rows;
}
export async function createAccount(data) {
  const res = await db.query(
    "INSERT INTO accounts (code,name,type,parent_id) VALUES ($1,$2,$3,$4) RETURNING *",
    [data.code, data.name, data.type, data.parent_id]
  );
  return res.rows[0];
}

// ─── Journal Entries ──────────────────────────────────────
export async function listJournals({ from, to } = {}) {
  const conds=[]; const vals=[]; let i=1;
  if(from){ conds.push(`entry_date>=$${i++}`); vals.push(from); }
  if(to)  { conds.push(`entry_date<=$${i++}`); vals.push(to); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT je.*,u.name AS created_by_name FROM journal_entries je
     LEFT JOIN users u ON u.id=je.created_by ${where} ORDER BY je.entry_date DESC`,
    vals
  );
  return res.rows;
}
export async function getJournal(id) {
  const [je, lines] = await Promise.all([
    db.query("SELECT * FROM journal_entries WHERE id=$1", [id]),
    db.query("SELECT jl.*,a.name AS account_name,a.code AS account_code FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.entry_id=$1", [id]),
  ]);
  if(!je.rows[0]) return null;
  return { ...je.rows[0], lines: lines.rows };
}
export async function createJournal(data, lines) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const jr = await client.query(
      "INSERT INTO journal_entries (entry_date,reference,description,created_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [data.entry_date||new Date().toISOString().split("T")[0], data.reference, data.description, data.created_by]
    );
    for (const l of lines) {
      await client.query(
        "INSERT INTO journal_lines (entry_id,account_id,debit,credit,description) VALUES ($1,$2,$3,$4,$5)",
        [jr.rows[0].id, l.account_id, l.debit||0, l.credit||0, l.description]
      );
    }
    await client.query("COMMIT");
    return jr.rows[0];
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ─── Expenses ─────────────────────────────────────────────
export async function listExpenses({ from, to } = {}) {
  const conds=[]; const vals=[]; let i=1;
  if(from){ conds.push(`expense_date>=$${i++}`); vals.push(from); }
  if(to)  { conds.push(`expense_date<=$${i++}`); vals.push(to); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT e.*,a.name AS account_name,u.name AS created_by_name FROM expenses e
     LEFT JOIN accounts a ON a.id=e.account_id LEFT JOIN users u ON u.id=e.created_by ${where} ORDER BY e.expense_date DESC`,
    vals
  );
  return res.rows;
}
export async function createExpense(data) {
  const res = await db.query(
    "INSERT INTO expenses (account_id,amount,expense_date,category,description,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [data.account_id, data.amount, data.expense_date||new Date().toISOString().split("T")[0], data.category, data.description, data.created_by]
  );
  return res.rows[0];
}

// ─── Reports ──────────────────────────────────────────────
export async function getPLReport({ from, to }) {
  const res = await db.query(
    `SELECT a.type,a.name,COALESCE(SUM(jl.credit-jl.debit),0) AS net
     FROM journal_lines jl
     JOIN accounts a ON a.id=jl.account_id
     JOIN journal_entries je ON je.id=jl.entry_id
     WHERE je.entry_date BETWEEN $1 AND $2 AND a.type IN ('income','expense')
     GROUP BY a.id ORDER BY a.type,a.name`,
    [from, to]
  );
  return res.rows;
}

export async function getLedger(account_id, { from, to }) {
  const res = await db.query(
    `SELECT jl.*,je.entry_date,je.description AS entry_desc,je.reference FROM journal_lines jl
     JOIN journal_entries je ON je.id=jl.entry_id
     WHERE jl.account_id=$1 AND je.entry_date BETWEEN $2 AND $3 ORDER BY je.entry_date`,
    [account_id, from, to]
  );
  return res.rows;
}
