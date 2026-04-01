import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = (v: any) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\r\n');
}

@Injectable()
export class ExportService {
  constructor(private readonly db: DatabaseService) {}

  async leadsCSV(from?: string, to?: string): Promise<string> {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if (from) { conds.push(`l.created_at >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`l.created_at <= $${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const res = await this.db.query(
      `SELECT l.id, l.name, l.email, l.phone, l.company,
              src.name AS source, stg.name AS stage,
              u.name AS assigned_to,
              l.is_converted, l.created_at
         FROM leads l
         LEFT JOIN lead_sources src ON src.id = l.source_id
         LEFT JOIN lead_stages  stg ON stg.id = l.stage_id
         LEFT JOIN users        u   ON u.id   = l.assigned_to
         ${where}
         ORDER BY l.created_at DESC`,
      vals,
    );
    return toCSV(res.rows);
  }

  async invoicesCSV(from?: string, to?: string): Promise<string> {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if (from) { conds.push(`invoice_date >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`invoice_date <= $${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const res = await this.db.query(
      `SELECT i.id, i.invoice_number, c.name AS customer,
              i.invoice_date, i.due_date,
              i.taxable_amount, i.cgst_amount, i.sgst_amount, i.igst_amount,
              i.total_amount, i.status
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         ${where}
         ORDER BY i.invoice_date DESC`,
      vals,
    );
    return toCSV(res.rows);
  }

  async employeesCSV(): Promise<string> {
    const res = await this.db.query(
      `SELECT e.id, e.employee_code, e.name, e.designation, e.department,
              e.date_of_joining, e.salary, e.is_active,
              u.email
         FROM employees e
         LEFT JOIN users u ON u.id = e.user_id
         ORDER BY e.name`,
    );
    return toCSV(res.rows);
  }

  async stockCSV(): Promise<string> {
    const res = await this.db.query(
      `SELECT p.sku, p.name AS product, p.hsn_code,
              w.name AS warehouse,
              s.quantity, s.reserved_quantity,
              (s.quantity - COALESCE(s.reserved_quantity,0)) AS available,
              p.reorder_level
         FROM stock s
         JOIN products   p ON p.id = s.product_id
         JOIN warehouses w ON w.id = s.warehouse_id
         ORDER BY p.name, w.name`,
    );
    return toCSV(res.rows);
  }
}
