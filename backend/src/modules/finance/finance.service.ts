import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  async listAccounts() { return (await this.db.query('SELECT * FROM accounts WHERE is_active=TRUE ORDER BY code')).rows; }
  async createAccount(d: any) {
    return (await this.db.query(
      'INSERT INTO accounts (code,name,type,parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [d.code, d.name, d.type, d.parent_id],
    )).rows[0];
  }

  async listJournals(from?: string, to?: string) {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if(from){ conds.push(`entry_date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`entry_date<=$${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT je.*,u.name AS created_by_name FROM journal_entries je LEFT JOIN users u ON u.id=je.created_by ${where} ORDER BY je.entry_date DESC`, vals
    )).rows;
  }
  async getJournal(id: number) {
    const [je, lines] = await Promise.all([
      this.db.query('SELECT * FROM journal_entries WHERE id=$1', [id]),
      this.db.query('SELECT jl.*,a.name AS account_name,a.code FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.entry_id=$1', [id]),
    ]);
    return je.rows[0] ? { ...je.rows[0], lines: lines.rows } : null;
  }
  async createJournal(data: any, lines: any[]) {
    return this.db.transaction(async (client) => {
      const jr = await client.query(
        'INSERT INTO journal_entries (entry_date,reference,description,created_by) VALUES ($1,$2,$3,$4) RETURNING *',
        [data.entry_date||new Date().toISOString().split('T')[0], data.reference, data.description, data.created_by],
      );
      for (const l of lines)
        await client.query('INSERT INTO journal_lines (entry_id,account_id,debit,credit,description) VALUES ($1,$2,$3,$4,$5)',
          [jr.rows[0].id, l.account_id, l.debit||0, l.credit||0, l.description]);
      return jr.rows[0];
    });
  }

  async listExpenses(from?: string, to?: string) {
    const conds: string[] = []; const vals: any[] = []; let i = 1;
    if(from){ conds.push(`expense_date>=$${i++}`); vals.push(from); }
    if(to)  { conds.push(`expense_date<=$${i++}`); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (await this.db.query(
      `SELECT e.*,a.name AS account_name,u.name AS created_by_name FROM expenses e LEFT JOIN accounts a ON a.id=e.account_id LEFT JOIN users u ON u.id=e.created_by ${where} ORDER BY e.expense_date DESC`, vals
    )).rows;
  }
  async createExpense(d: any) {
    return (await this.db.query(
      'INSERT INTO expenses (account_id,amount,expense_date,category,description,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [d.account_id, d.amount, d.expense_date||new Date().toISOString().split('T')[0], d.category, d.description, d.created_by],
    )).rows[0];
  }

  async getPLReport(from: string, to: string) {
    return (await this.db.query(
      `SELECT a.type,a.name,COALESCE(SUM(jl.credit-jl.debit),0) AS net
       FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id JOIN journal_entries je ON je.id=jl.entry_id
       WHERE je.entry_date BETWEEN $1 AND $2 AND a.type IN ('income','expense')
       GROUP BY a.id ORDER BY a.type,a.name`, [from, to]
    )).rows;
  }

  async getGSTReport(from: string, to: string) {
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
       ORDER BY invoice_date`,
      [from, to],
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

  async summary() {
    const res = await this.db.query(`
      SELECT
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                           AS revenue,
        (SELECT COALESCE(SUM(amount),0)       FROM expenses)                                               AS expenses,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial'))          AS receivable,
        (SELECT COALESCE(SUM(total_amount),0) FROM purchase_invoices)                                      AS payables,
        (SELECT COUNT(*)::int                 FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW()) AS overdue_invoices
    `);
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

  async getLedger(accountId: number, from: string, to: string) {
    return (await this.db.query(
      `SELECT jl.*,je.entry_date,je.description AS entry_desc,je.reference FROM journal_lines jl
       JOIN journal_entries je ON je.id=jl.entry_id
       WHERE jl.account_id=$1 AND je.entry_date BETWEEN $2 AND $3 ORDER BY je.entry_date`,
      [accountId, from, to],
    )).rows;
  }
}
