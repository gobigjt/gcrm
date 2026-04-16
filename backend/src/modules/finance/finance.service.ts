import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new ForbiddenException('Tenant context is required');
    return tenantId;
  }

  async listAccounts(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('SELECT * FROM accounts WHERE is_active=TRUE AND ($1::integer = 0 OR tenant_id = $1) ORDER BY code', [tenantId])).rows;
  }
  async createAccount(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO accounts (code,name,type,parent_id,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [d.code, d.name, d.type, d.parent_id, tenantId || null],
    )).rows[0];
  }

  async listJournals(from?: string, to?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const conds: string[] = ['($1::integer = 0 OR je.tenant_id = $1)']; const vals: any[] = [tenantId]; let i = 2;
    if(from){ conds.push(`entry_date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`entry_date<=$${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT je.*,u.name AS created_by_name FROM journal_entries je LEFT JOIN users u ON u.id=je.created_by ${where} ORDER BY je.entry_date DESC`, vals
    )).rows;
  }
  async getJournal(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const [je, lines] = await Promise.all([
      this.db.query('SELECT * FROM journal_entries WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]),
      this.db.query('SELECT jl.*,a.name AS account_name,a.code FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.entry_id=$1 AND ($2::integer = 0 OR jl.tenant_id = $2)', [id, tenantId]),
    ]);
    return je.rows[0] ? { ...je.rows[0], lines: lines.rows } : null;
  }
  async createJournal(data: any, lines: any[], ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return this.db.transaction(async (client) => {
      const jr = await client.query(
        'INSERT INTO journal_entries (entry_date,reference,description,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [data.entry_date||new Date().toISOString().split('T')[0], data.reference, data.description, data.created_by, tenantId || null],
      );
      for (const l of lines)
        await client.query('INSERT INTO journal_lines (entry_id,account_id,debit,credit,description,tenant_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [jr.rows[0].id, l.account_id, l.debit||0, l.credit||0, l.description, tenantId || null]);
      return jr.rows[0];
    });
  }

  async listExpenses(from?: string, to?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const conds: string[] = ['($1::integer = 0 OR e.tenant_id = $1)']; const vals: any[] = [tenantId]; let i = 2;
    if(from){ conds.push(`expense_date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`expense_date<=$${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT e.*,a.name AS account_name,u.name AS created_by_name FROM expenses e LEFT JOIN accounts a ON a.id=e.account_id LEFT JOIN users u ON u.id=e.created_by ${where} ORDER BY e.expense_date DESC`, vals
    )).rows;
  }
  async createExpense(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      'INSERT INTO expenses (account_id,amount,expense_date,category,description,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [d.account_id, d.amount, d.expense_date||new Date().toISOString().split('T')[0], d.category, d.description, d.created_by, tenantId || null],
    )).rows[0];
  }

  async getPLReport(from: string, to: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT a.type,a.name,COALESCE(SUM(jl.credit-jl.debit),0) AS net
       FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id JOIN journal_entries je ON je.id=jl.entry_id
       WHERE je.entry_date BETWEEN $1 AND $2 AND a.type IN ('income','expense') AND ($3::integer = 0 OR je.tenant_id = $3)
       GROUP BY a.id ORDER BY a.type,a.name`,
      [from, to, tenantId],
    )).rows;
  }

  async getGSTReport(from: string, to: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query(
      `SELECT
         invoice_date,
         customer_id,
         invoice_number,
         taxable_amount,
         cgst_amount,
         sgst_amount,
         igst_amount,
         (cgst_amount + sgst_amount + igst_amount) AS total_tax,
         total_amount,
         status
       FROM invoices
      WHERE invoice_date BETWEEN $1 AND $2
        AND ($3::integer = 0 OR tenant_id = $3)
       ORDER BY invoice_date`,
      [from, to, tenantId],
    );
    const rows = res.rows;
    const totals = rows.reduce(
      (acc, r) => ({
        taxable:   acc.taxable   + Number(r.taxable_amount  || 0),
        cgst:      acc.cgst      + Number(r.cgst_amount     || 0),
        sgst:      acc.sgst      + Number(r.sgst_amount     || 0),
        igst:      acc.igst      + Number(r.igst_amount     || 0),
        total_tax: acc.total_tax + Number(r.total_tax       || 0),
        total:     acc.total     + Number(r.total_amount    || 0),
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0, total: 0 },
    );
    return { from, to, invoices: rows, totals };
  }

  async summary(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query(`
      SELECT
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid' AND ($1::integer = 0 OR tenant_id = $1))                           AS revenue,
        (SELECT COALESCE(SUM(amount),0)       FROM expenses WHERE ($1::integer = 0 OR tenant_id = $1))                                               AS expenses,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial') AND ($1::integer = 0 OR tenant_id = $1))          AS receivable,
        (SELECT COALESCE(SUM(total_amount),0) FROM purchase_invoices WHERE ($1::integer = 0 OR tenant_id = $1))                                      AS payables,
        (SELECT COUNT(*)::int                 FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW() AND ($1::integer = 0 OR tenant_id = $1)) AS overdue_invoices
    `, [tenantId]);
    const r = res.rows[0];
    return {
      revenue:          Number(r.revenue),
      expenses:         Number(r.expenses),
      net_profit:       Number(r.revenue) - Number(r.expenses),
      receivable:       Number(r.receivable),
      payables:         Number(r.payables),
      overdue_invoices: r.overdue_invoices,
    };
  }

  async getLedger(accountId: number, from: string, to: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT jl.*,je.entry_date,je.description AS entry_desc,je.reference FROM journal_lines jl
       JOIN journal_entries je ON je.id=jl.entry_id
       WHERE jl.account_id=$1 AND je.entry_date BETWEEN $2 AND $3 AND ($4::integer = 0 OR je.tenant_id = $4) ORDER BY je.entry_date`,
      [accountId, from, to, tenantId],
    )).rows;
  }
}
