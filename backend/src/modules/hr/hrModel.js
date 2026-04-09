import db from "../../config/database.js";

// ─── Employees ────────────────────────────────────────────
export async function listEmployees() {
  const res = await db.query(
    `SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.employee_code`
  );
  return res.rows;
}
export async function getEmployee(id) {
  const res = await db.query(
    `SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.id=$1`, [id]
  );
  return res.rows[0];
}
export async function createEmployee(data) {
  const res = await db.query(
    `INSERT INTO employees (user_id,employee_code,department,designation,date_of_joining,date_of_birth,phone,address,bank_account,ifsc_code,pan_number,basic_salary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [data.user_id, data.employee_code, data.department, data.designation, data.date_of_joining,
     data.date_of_birth, data.phone, data.address, data.bank_account, data.ifsc_code, data.pan_number, data.basic_salary||0]
  );
  return res.rows[0];
}
export async function updateEmployee(id, data) {
  const fields = ["department","designation","phone","address","bank_account","ifsc_code","pan_number","basic_salary","is_active"];
  const sets=[]; const vals=[]; let i=1;
  for (const f of fields) { if(data[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(data[f]); } }
  if (!sets.length) return null;
  vals.push(id);
  const res = await db.query(`UPDATE employees SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
  return res.rows[0];
}

// ─── Attendance (user_id → users.id) ──────────────────────
export async function markAttendance({ user_id, date, check_in, check_out, status, notes }) {
  const res = await db.query(
    `INSERT INTO attendance (user_id,date,check_in,check_out,status,notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id,date) DO UPDATE SET check_in=$3,check_out=$4,status=$5,notes=$6
     RETURNING *`,
    [user_id, date, check_in, check_out, status||"present", notes]
  );
  return res.rows[0];
}
export async function getAttendance({ employee_id, from, to }) {
  const er = await db.query(`SELECT user_id FROM employees WHERE id=$1`, [employee_id]);
  if (!er.rows[0]?.user_id) return [];
  const uid = er.rows[0].user_id;
  const conds=["user_id=$1"]; const vals=[uid]; let i=2;
  if(from){ conds.push(`date>=$${i++}`); vals.push(from); }
  if(to)  { conds.push(`date<=$${i++}`); vals.push(to); }
  const res = await db.query(
    `SELECT * FROM attendance WHERE ${conds.join(" AND ")} ORDER BY date`,
    vals
  );
  return res.rows;
}
export async function getAttendanceSummary({ from, to }) {
  const res = await db.query(
    `SELECT COALESCE(e.employee_code, '—') AS employee_code, u.name,
       COUNT(*) FILTER (WHERE a.status='present') AS present,
       COUNT(*) FILTER (WHERE a.status='absent') AS absent,
       COUNT(*) FILTER (WHERE a.status='half_day') AS half_day,
       COUNT(*) FILTER (WHERE a.status='leave') AS leave
     FROM attendance a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN employees e ON e.user_id = u.id AND e.is_active = TRUE
     WHERE a.date BETWEEN $1 AND $2
     GROUP BY u.id, u.name, e.employee_code
     ORDER BY e.employee_code NULLS LAST, u.name`,
    [from, to]
  );
  return res.rows;
}

// ─── Payroll ──────────────────────────────────────────────
export async function listPayroll({ month, year }) {
  const res = await db.query(
    `SELECT p.*,e.employee_code,u.name AS employee_name FROM payroll p
     JOIN employees e ON e.id=p.employee_id LEFT JOIN users u ON u.id=e.user_id
     WHERE p.month=$1 AND p.year=$2 ORDER BY e.employee_code`,
    [month, year]
  );
  return res.rows;
}
export async function createPayrollEntry(data) {
  const gross = Number(data.basic||0) + Number(data.hra||0) + Number(data.allowances||0);
  const net   = gross - Number(data.deductions||0) - Number(data.pf||0);
  const res = await db.query(
    `INSERT INTO payroll (employee_id,month,year,basic,hra,allowances,deductions,pf,gross,net,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     ON CONFLICT (employee_id,month,year) DO UPDATE
     SET basic=$4,hra=$5,allowances=$6,deductions=$7,pf=$8,gross=$9,net=$10,status='draft'
     RETURNING *`,
    [data.employee_id, data.month, data.year, data.basic||0, data.hra||0, data.allowances||0,
     data.deductions||0, data.pf||0, gross, net]
  );
  return res.rows[0];
}
export async function processPayroll(id) {
  const res = await db.query(
    "UPDATE payroll SET status='processed' WHERE id=$1 RETURNING *", [id]
  );
  return res.rows[0];
}
export async function payPayroll(id) {
  const res = await db.query(
    "UPDATE payroll SET status='paid',paid_on=CURRENT_DATE WHERE id=$1 RETURNING *", [id]
  );
  return res.rows[0];
}
