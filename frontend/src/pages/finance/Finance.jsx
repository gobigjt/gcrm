import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import Table from '../../components/Table';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import Tabs  from '../../components/Tabs';

/* ── helpers ─────────────────────────────────────── */
const fmt  = n => `₹${Number(n||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

const today  = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

/* ── stat card ───────────────────────────────────── */
function StatCard({ label, value, sub, color = 'slate', icon }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red:     'bg-red-50 border-red-200 text-red-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    violet:  'bg-violet-50 border-violet-200 text-violet-700',
    slate:   'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        {icon && <span className="text-lg opacity-50">{icon}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

/* ── expense modal ───────────────────────────────── */
function ExpenseModal({ accounts, onSave, onClose }) {
  const { show } = useToast();
  const [form, setForm] = useState({ account_id: '', amount: '', expense_date: today(), category: '', description: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const CATS = ['Rent','Utilities','Salaries','Travel','Office Supplies','Marketing','Maintenance','Miscellaneous'];

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/finance/expenses', form);
      show('Expense saved successfully', 'success');
      onSave();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save expense'), 'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Add Expense</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input type="date" required value={form.expense_date} onChange={e => set('expense_date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Amount (₹)</label>
              <input type="number" required min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">— select —</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Account</label>
            <select value={form.account_id} onChange={e => set('account_id', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">— none —</option>
              {accounts.filter(a => a.type === 'expense').map(a => (
                <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">Save</button>
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── journal modal ───────────────────────────────── */
function JournalModal({ accounts, onSave, onClose }) {
  const { show } = useToast();
  const [form, setForm] = useState({ entry_date: today(), reference: '', description: '' });
  const [lines, setLines] = useState([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ]);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setLine = (i, k, v) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(ls => [...ls, { account_id: '', debit: '', credit: '', description: '' }]);
  const rmLine  = i  => setLines(ls => ls.filter((_, idx) => idx !== i));

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  async function submit(e) {
    e.preventDefault();
    if (!balanced) return;
    try {
      await api.post('/finance/journals', { ...form, lines });
      show('Journal entry saved successfully', 'success');
      onSave();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save journal'), 'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">New Journal Entry</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input type="date" required value={form.entry_date} onChange={e => setF('entry_date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Reference</label>
              <input value={form.reference} onChange={e => setF('reference', e.target.value)}
                placeholder="JV-001" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Description</label>
              <input value={form.description} onChange={e => setF('description', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Account</th>
                  <th className="text-right px-3 py-2 w-28">Debit</th>
                  <th className="text-right px-3 py-2 w-28">Credit</th>
                  <th className="text-left px-3 py-2">Narration</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">
                      <select value={l.account_id} onChange={e => setLine(i, 'account_id', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm">
                        <option value="">— select —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.01" value={l.debit} onChange={e => setLine(i, 'debit', e.target.value)}
                        placeholder="0.00" className="w-full border rounded px-2 py-1 text-sm text-right" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.01" value={l.credit} onChange={e => setLine(i, 'credit', e.target.value)}
                        placeholder="0.00" className="w-full border rounded px-2 py-1 text-sm text-right" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={l.description} onChange={e => setLine(i, 'description', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      {lines.length > 2 && (
                        <button type="button" onClick={() => rmLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t text-xs font-semibold">
                <tr>
                  <td className="px-3 py-2 text-slate-500">Totals</td>
                  <td className={`px-3 py-2 text-right ${!balanced ? 'text-red-600' : 'text-emerald-600'}`}>{fmtN(totalDebit)}</td>
                  <td className={`px-3 py-2 text-right ${!balanced ? 'text-red-600' : 'text-emerald-600'}`}>{fmtN(totalCredit)}</td>
                  <td colSpan={2} className="px-3 py-2">
                    {!balanced && <span className="text-red-500">Not balanced (diff: {fmtN(Math.abs(totalDebit - totalCredit))})</span>}
                    {balanced && <span className="text-emerald-600">Balanced ✓</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" onClick={addLine} className="text-sm text-indigo-600 hover:text-indigo-700">+ Add line</button>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={!balanced}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
              Save Entry
            </button>
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── P&L report ──────────────────────────────────── */
function PLReport() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/finance/reports/pl', { params: { from, to } });
      setRows(r.data || []);
    } catch {}
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const income  = rows.filter(r => r.type === 'income');
  const expense = rows.filter(r => r.type === 'expense');
  const totalIncome  = income.reduce((s, r) => s + Number(r.net), 0);
  const totalExpense = expense.reduce((s, r) => s + Math.abs(Number(r.net)), 0);
  const netProfit    = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          <label className="text-slate-500">To</label>
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={load} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700">
          {loading ? 'Loading…' : 'Run'}
        </button>
      </div>

      {rows.length === 0 && !loading && (
        <p className="text-slate-400 text-sm py-8 text-center">No journal data for this period.</p>
      )}

      {rows.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3">Account</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {income.length > 0 && (
                <tr className="bg-emerald-50/50">
                  <td colSpan={3} className="px-4 py-2 text-xs font-bold text-emerald-700 uppercase">Income</td>
                </tr>
              )}
              {income.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 text-emerald-600 capitalize">{r.type}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{fmt(r.net)}</td>
                </tr>
              ))}
              {income.length > 0 && (
                <tr className="bg-emerald-50 font-semibold">
                  <td className="px-4 py-2" colSpan={2}>Total Income</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{fmt(totalIncome)}</td>
                </tr>
              )}

              {expense.length > 0 && (
                <tr className="bg-red-50/50">
                  <td colSpan={3} className="px-4 py-2 text-xs font-bold text-red-700 uppercase">Expenses</td>
                </tr>
              )}
              {expense.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 text-red-500 capitalize">{r.type}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-red-500">{fmt(Math.abs(r.net))}</td>
                </tr>
              ))}
              {expense.length > 0 && (
                <tr className="bg-red-50 font-semibold">
                  <td className="px-4 py-2" colSpan={2}>Total Expenses</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmt(totalExpense)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className={`font-bold text-base ${netProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <td className="px-4 py-3" colSpan={2}>Net Profit / Loss</td>
                <td className={`px-4 py-3 text-right ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── GST report ──────────────────────────────────── */
function GSTReport() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/finance/reports/gst', { params: { from, to } });
      setData(r.data);
    } catch {}
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          <label className="text-slate-500">To</label>
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={load} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700">
          {loading ? 'Loading…' : 'Run'}
        </button>
      </div>

      {data && data.invoices.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">No invoices for this period.</p>
      )}

      {data && data.invoices.length > 0 && (
        <>
          {/* summary cards */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: 'Taxable',   val: data.totals.taxable },
              { label: 'CGST',      val: data.totals.cgst },
              { label: 'SGST',      val: data.totals.sgst },
              { label: 'IGST',      val: data.totals.igst },
              { label: 'Total Tax', val: data.totals.total_tax },
              { label: 'Invoice Total', val: data.totals.total },
            ].map(({ label, val }) => (
              <div key={label} className="bg-slate-50 border rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className="font-semibold text-sm">{fmt(val)}</div>
              </div>
            ))}
          </div>

          {/* detail table */}
          <div className="border rounded-xl overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-3">Date</th>
                  <th className="text-left px-3 py-3">Invoice #</th>
                  <th className="text-right px-3 py-3">Taxable</th>
                  <th className="text-right px-3 py-3">CGST</th>
                  <th className="text-right px-3 py-3">SGST</th>
                  <th className="text-right px-3 py-3">IGST</th>
                  <th className="text-right px-3 py-3">Total Tax</th>
                  <th className="text-right px-3 py-3">Total</th>
                  <th className="text-left px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">{inv.invoice_date?.slice(0,10)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(inv.taxable_amount)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(inv.cgst_amount)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(inv.sgst_amount)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(inv.igst_amount)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(inv.total_tax)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{fmt(inv.total_amount)}</td>
                    <td className="px-3 py-2.5 capitalize text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        inv.status==='paid' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status==='overdue' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 text-xs font-bold border-t">
                <tr>
                  <td className="px-3 py-2.5" colSpan={2}>Totals</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.taxable)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.cgst)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.sgst)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.igst)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.total_tax)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(data.totals.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── type badge ──────────────────────────────────── */
const typeBadge = t => {
  const cls = {
    asset:     'bg-blue-100 text-blue-700',
    liability: 'bg-amber-100 text-amber-700',
    equity:    'bg-violet-100 text-violet-700',
    income:    'bg-emerald-100 text-emerald-700',
    expense:   'bg-red-100 text-red-600',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[t]||'bg-slate-100 text-slate-600'}`}>{t}</span>;
};

/* ── main ────────────────────────────────────────── */
const FIN_TAB_BY_PARAM = {
  overview: 'Overview',
  accounts: 'Accounts',
  journal: 'Journal Entries',
  journals: 'Journal Entries',
  expenses: 'Expenses',
  reports: 'P&L Report',
  pl: 'P&L Report',
  pnl: 'P&L Report',
  profit: 'P&L Report',
  gst: 'GST Report',
  tax: 'GST Report',
};

export default function Finance() {
  const [searchParams] = useSearchParams();
  const [tab,      setTab]      = useState('Overview');
  const [summary,  setSummary]  = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [modal,    setModal]    = useState(null); // 'expense' | 'journal'

  const reload = useCallback(async () => {
    const [s, a, j, e] = await Promise.allSettled([
      api.get('/finance/summary'),
      api.get('/finance/accounts'),
      api.get('/finance/journals'),
      api.get('/finance/expenses'),
    ]);
    if (s.status === 'fulfilled') setSummary(s.value.data);
    if (a.status === 'fulfilled') setAccounts(a.value.data.accounts || a.value.data || []);
    if (j.status === 'fulfilled') setJournals(j.value.data.journals || j.value.data || []);
    if (e.status === 'fulfilled') setExpenses(e.value.data.expenses || e.value.data || []);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = FIN_TAB_BY_PARAM[raw];
    if (mapped) setTab(mapped);
    else if (!searchParams.get('tab')) setTab('Overview');
  }, [searchParams]);

  function closeModal() { setModal(null); reload(); }

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Finance</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Accounts, journals, expenses and tax reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('expense')} className="btn-wf-secondary">
            + Add Expense
          </button>
          <button onClick={() => setModal('journal')} className="btn-wf-primary">
            + Journal Entry
          </button>
        </div>
      </div>

      {/* stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard label="Revenue"          value={fmt(summary.revenue)}         color="emerald" icon="💰" />
          <StatCard label="Expenses"         value={fmt(summary.expenses)}         color="red"     icon="📤" />
          <StatCard label="Net Profit"       value={fmt(summary.net_profit)}       color={summary.net_profit >= 0 ? 'blue' : 'red'} icon="📊" />
          <StatCard label="Receivable"       value={fmt(summary.receivable)}       color="amber"   icon="🕐" />
          <StatCard label="Payables"         value={fmt(summary.payables)}         color="violet"  icon="📋" />
          <StatCard label="Overdue Invoices" value={summary.overdue_invoices}      color={summary.overdue_invoices > 0 ? 'red' : 'slate'} icon="⚠️" />
        </div>
      )}

      <Tabs tabs={['Overview','Accounts','Journal Entries','Expenses','P&L Report','GST Report']} active={tab} onChange={setTab} />

      {/* overview tab */}
      {tab === 'Overview' && (
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Recent Journal Entries</h4>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {journals.slice(0, 5).map(j => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-xs text-slate-500">{j.entry_date?.slice(0,10)}</td>
                      <td className="px-3 py-2.5">{j.description}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{j.reference}</td>
                    </tr>
                  ))}
                  {journals.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-sm">No entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Recent Expenses</h4>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.slice(0, 5).map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-xs text-slate-500">{e.expense_date?.slice(0,10)}</td>
                      <td className="px-3 py-2.5">{e.category || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-red-600">{fmt(e.amount)}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-sm">No expenses</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* accounts */}
      {tab === 'Accounts' && (
        <div className="mt-4">
          <Table
            cols={['Code','Name','Type','Active']}
            rows={accounts.map(a => [a.code, a.name, typeBadge(a.type), a.is_active ? '✓' : '—'])}
            empty="No accounts"
          />
        </div>
      )}

      {/* journals */}
      {tab === 'Journal Entries' && (
        <div className="mt-4">
          <Table
            cols={['Date','Description','Reference','Created By']}
            rows={journals.map(j => [j.entry_date?.slice(0,10), j.description, j.reference, j.created_by_name])}
            empty="No journal entries"
          />
        </div>
      )}

      {/* expenses */}
      {tab === 'Expenses' && (
        <div className="mt-4">
          <Table
            cols={['Date','Category','Amount','Account','Description','Created By']}
            rows={expenses.map(e => [
              e.expense_date?.slice(0,10),
              e.category || '—',
              <span className="font-medium text-red-600">{fmt(e.amount)}</span>,
              e.account_name || '—',
              e.description,
              e.created_by_name,
            ])}
            empty="No expenses — add one with the button above"
          />
        </div>
      )}

      {/* P&L */}
      {tab === 'P&L Report' && <div className="mt-4"><PLReport /></div>}

      {/* GST */}
      {tab === 'GST Report' && <div className="mt-4"><GSTReport /></div>}

      {/* modals */}
      {modal === 'expense' && (
        <ExpenseModal accounts={accounts} onSave={closeModal} onClose={() => setModal(null)} />
      )}
      {modal === 'journal' && (
        <JournalModal accounts={accounts} onSave={closeModal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
