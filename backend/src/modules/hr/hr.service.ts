import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class HrService {
  constructor(private readonly db: DatabaseService) {}

  async listEmployees() {
    return (await this.db.query(`SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.employee_code`)).rows;
  }
  async getEmployee(id: number) {
    return (await this.db.query(`SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.id=$1`, [id])).rows[0];
  }
  async createEmployee(d: any) {
    return (await this.db.query(
      `INSERT INTO employees (user_id,employee_code,department,designation,date_of_joining,date_of_birth,phone,address,bank_account,ifsc_code,pan_number,basic_salary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.user_id, d.employee_code, d.department, d.designation, d.date_of_joining, d.date_of_birth, d.phone, d.address, d.bank_account, d.ifsc_code, d.pan_number, d.basic_salary||0],
    )).rows[0];
  }
  async updateEmployee(id: number, d: any) {
    const fields = ['department','designation','phone','address','bank_account','ifsc_code','pan_number','basic_salary','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id);
    return (await this.db.query(`UPDATE employees SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals)).rows[0];
  }

  async markAttendance(d: any) {
    return (await this.db.query(
      `INSERT INTO attendance (employee_id,date,check_in,check_out,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (employee_id,date) DO UPDATE SET check_in=$3,check_out=$4,status=$5,notes=$6 RETURNING *`,
      [d.employee_id, d.date, d.check_in, d.check_out, d.status||'present', d.notes],
    )).rows[0];
  }
  async getAttendance(employeeId: number, from?: string, to?: string) {
    const conds = ['employee_id=$1']; const vals: any[] = [employeeId]; let i = 2;
    if(from){ conds.push(`date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`date<=$${i++}`); vals.push(to); }
    return (await this.db.query(`SELECT * FROM attendance WHERE ${conds.join(' AND ')} ORDER BY date`, vals)).rows;
  }
  async getAttendanceSummary(from: string, to: string) {
    return (await this.db.query(
      `SELECT e.employee_code,u.name,
         COUNT(*) FILTER (WHERE a.status='present') AS present,
         COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
         COUNT(*) FILTER (WHERE a.status='half_day') AS half_day,
         COUNT(*) FILTER (WHERE a.status='leave')   AS leave
       FROM attendance a JOIN employees e ON e.id=a.employee_id LEFT JOIN users u ON u.id=e.user_id
       WHERE a.date BETWEEN $1 AND $2 GROUP BY e.id,u.name ORDER BY e.employee_code`, [from, to]
    )).rows;
  }

  async listPayroll(month: number, year: number) {
    return (await this.db.query(
      `SELECT p.*,e.employee_code,u.name AS employee_name FROM payroll p
       JOIN employees e ON e.id=p.employee_id LEFT JOIN users u ON u.id=e.user_id
       WHERE p.month=$1 AND p.year=$2 ORDER BY e.employee_code`, [month, year]
    )).rows;
  }
  async createPayroll(d: any) {
    const gross = Number(d.basic||0) + Number(d.hra||0) + Number(d.allowances||0);
    const net   = gross - Number(d.deductions||0) - Number(d.pf||0);
    return (await this.db.query(
      `INSERT INTO payroll (employee_id,month,year,basic,hra,allowances,deductions,pf,gross,net,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
       ON CONFLICT (employee_id,month,year) DO UPDATE SET basic=$4,hra=$5,allowances=$6,deductions=$7,pf=$8,gross=$9,net=$10,status='draft' RETURNING *`,
      [d.employee_id, d.month, d.year, d.basic||0, d.hra||0, d.allowances||0, d.deductions||0, d.pf||0, gross, net],
    )).rows[0];
  }
  async processPayroll(id: number) {
    return (await this.db.query("UPDATE payroll SET status='processed' WHERE id=$1 RETURNING *", [id])).rows[0];
  }
  async payPayroll(id: number) {
    return (await this.db.query("UPDATE payroll SET status='paid',paid_on=CURRENT_DATE WHERE id=$1 RETURNING *", [id])).rows[0];
  }
}
