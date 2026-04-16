import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class HrService {
  constructor(private readonly db: DatabaseService) {}
  private readonly attendanceTimezone = process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata';

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new ForbiddenException('Tenant context is required');
    return tenantId;
  }

  /** Today’s attendance row for a CRM user (`attendance.user_id` → `users.id`). */
  async getTodayAttendanceByUserId(userId: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const r = await this.db.query(
      `SELECT *
       FROM attendance
       WHERE user_id=$1 AND date = (NOW() AT TIME ZONE $2)::date AND ($3::integer = 0 OR tenant_id = $3)`,
      [userId, this.attendanceTimezone, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async selfCheckIn(userId: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query(
      `INSERT INTO attendance AS a (user_id, date, check_in, status, tenant_id)
       VALUES ($1, (NOW() AT TIME ZONE $2)::date, (NOW() AT TIME ZONE $2)::time(0), 'present', $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         check_in = (NOW() AT TIME ZONE $2)::time(0),
         status = 'present',
         tenant_id = COALESCE(a.tenant_id, EXCLUDED.tenant_id)
       WHERE a.check_in IS NULL
       RETURNING *`,
      [userId, this.attendanceTimezone, tenantId || null],
    );
    if (!res.rows[0]) {
      throw new BadRequestException('You already checked in today.');
    }
    return res.rows[0];
  }

  async selfCheckOut(userId: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const existing = (
      await this.db.query(
        `SELECT id, check_in, check_out
         FROM attendance
         WHERE user_id=$1 AND date=(NOW() AT TIME ZONE $2)::date AND ($3::integer = 0 OR tenant_id = $3)`,
        [userId, this.attendanceTimezone, tenantId],
      )
    ).rows[0];
    if (!existing || existing.check_in == null) {
      throw new BadRequestException('Check in before checking out.');
    }
    if (existing.check_out != null) {
      throw new BadRequestException('You already checked out today.');
    }
    const upd = await this.db.query(
      `UPDATE attendance
       SET check_out=(NOW() AT TIME ZONE $2)::time(0)
       WHERE id=$1
       RETURNING *`,
      [existing.id, this.attendanceTimezone],
    );
    return upd.rows[0];
  }

  async listEmployees(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id
       WHERE ($1::integer = 0 OR e.tenant_id = $1)
       ORDER BY e.employee_code`, [tenantId]
    )).rows;
  }
  async getEmployee(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(`SELECT e.*,u.name AS user_name,u.email FROM employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.id=$1 AND ($2::integer = 0 OR e.tenant_id = $2)`, [id, tenantId])).rows[0];
  }
  async createEmployee(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `INSERT INTO employees (user_id,employee_code,department,designation,date_of_joining,date_of_birth,phone,address,bank_account,ifsc_code,pan_number,basic_salary,tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [d.user_id, d.employee_code, d.department, d.designation, d.date_of_joining, d.date_of_birth, d.phone, d.address, d.bank_account, d.ifsc_code, d.pan_number, d.basic_salary||0, tenantId || null],
    )).rows[0];
  }
  async updateEmployee(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const fields = ['department','designation','phone','address','bank_account','ifsc_code','pan_number','basic_salary','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id, tenantId);
    return (await this.db.query(`UPDATE employees SET ${sets.join(',')} WHERE id=$${i} AND ($${i+1}::integer = 0 OR tenant_id = $${i+1}) RETURNING *`, vals)).rows[0];
  }

  async markAttendance(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const uid = d.user_id ?? d.userId;
    if (uid == null) throw new BadRequestException('user_id is required');
    return (await this.db.query(
      `INSERT INTO attendance (user_id,date,check_in,check_out,status,notes,tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id,date) DO UPDATE SET check_in=$3,check_out=$4,status=$5,notes=$6,tenant_id=COALESCE(attendance.tenant_id, EXCLUDED.tenant_id) RETURNING *`,
      [uid, d.date, d.check_in, d.check_out, d.status||'present', d.notes, tenantId || null],
    )).rows[0];
  }
  async getAttendance(employeeId: number, from?: string, to?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const er = (await this.db.query(`SELECT user_id FROM employees WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)`, [employeeId, tenantId])).rows[0];
    if (!er?.user_id) return [];
    return this.getAttendanceByUserId(Number(er.user_id), from, to, ctx);
  }
  async getAttendanceByUserId(userId: number, from?: string, to?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const conds = ['user_id=$1','($2::integer = 0 OR tenant_id = $2)']; const vals: any[] = [userId, tenantId]; let i = 3;
    if(from){ conds.push(`date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`date<=$${i++}`); vals.push(to); }
    return (await this.db.query(`SELECT * FROM attendance WHERE ${conds.join(' AND ')} ORDER BY date`, vals)).rows;
  }
  async getAttendanceSummary(from: string, to: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT COALESCE(e.employee_code, '—') AS employee_code, u.name,
         COUNT(*) FILTER (WHERE a.status='present') AS present,
         COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
         COUNT(*) FILTER (WHERE a.status='half_day') AS half_day,
         COUNT(*) FILTER (WHERE a.status='leave')   AS leave
       FROM attendance a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN employees e ON e.user_id = u.id AND e.is_active = TRUE
       WHERE a.date BETWEEN $1 AND $2 AND ($3::integer = 0 OR a.tenant_id = $3)
       GROUP BY u.id, u.name, e.employee_code
       ORDER BY e.employee_code NULLS LAST, u.name`, [from, to, tenantId]
    )).rows;
  }

  /** Daily rows in range: date, employee_code, name, check_in, check_out, status (for HR list). */
  async listAttendanceRecords(from: string, to: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (
      await this.db.query(
        `SELECT a.date::text AS date,
           COALESCE(
             (SELECT e2.employee_code FROM employees e2
              WHERE e2.user_id = u.id AND e2.is_active = TRUE
              ORDER BY e2.employee_code LIMIT 1),
             '—'
           ) AS employee_code,
           u.name AS name,
           a.check_in::text AS check_in,
           a.check_out::text AS check_out,
           a.status
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE a.date BETWEEN $1 AND $2 AND ($3::integer = 0 OR a.tenant_id = $3)
         ORDER BY a.date DESC, employee_code, u.name`,
        [from, to, tenantId],
      )
    ).rows;
  }

  async listPayroll(month: number, year: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT p.*,e.employee_code,u.name AS employee_name FROM payroll p
       JOIN employees e ON e.id=p.employee_id LEFT JOIN users u ON u.id=e.user_id
       WHERE p.month=$1 AND p.year=$2 AND ($3::integer = 0 OR p.tenant_id = $3) ORDER BY e.employee_code`, [month, year, tenantId]
    )).rows;
  }
  async createPayroll(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const gross = Number(d.basic||0) + Number(d.hra||0) + Number(d.allowances||0);
    const net   = gross - Number(d.deductions||0) - Number(d.pf||0);
    return (await this.db.query(
      `INSERT INTO payroll (employee_id,month,year,basic,hra,allowances,deductions,pf,gross,net,status,tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11)
       ON CONFLICT (employee_id,month,year) DO UPDATE SET basic=$4,hra=$5,allowances=$6,deductions=$7,pf=$8,gross=$9,net=$10,status='draft',tenant_id=COALESCE(payroll.tenant_id, EXCLUDED.tenant_id) RETURNING *`,
      [d.employee_id, d.month, d.year, d.basic||0, d.hra||0, d.allowances||0, d.deductions||0, d.pf||0, gross, net, tenantId || null],
    )).rows[0];
  }
  async processPayroll(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query("UPDATE payroll SET status='processed' WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2) RETURNING *", [id, tenantId])).rows[0];
  }
  async payPayroll(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query("UPDATE payroll SET status='paid',paid_on=CURRENT_DATE WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2) RETURNING *", [id, tenantId])).rows[0];
  }
}
