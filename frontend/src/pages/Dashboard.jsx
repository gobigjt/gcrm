import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

// ─── Formatters ───────────────────────────────────────────────
const fmtINR = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtINRShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000)       return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v}`;
};
const fmtD = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

// ─── Styles ───────────────────────────────────────────────────
const cardCls =
  'bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4';

const STATUS_CLS = {
  paid:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unpaid:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

// ─── Custom Tooltip for Charts ────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {fmtINRShort(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = 'brand', to }) {
  const colors = {
    brand:  'bg-brand-50   dark:bg-brand-900/20  text-brand-600  dark:text-brand-400',
    green:  'bg-green-50   dark:bg-green-900/20  text-green-600  dark:text-green-400',
    red:    'bg-red-50     dark:bg-red-900/20    text-red-600    dark:text-red-400',
    amber:  'bg-amber-50   dark:bg-amber-900/20  text-amber-600  dark:text-amber-400',
    violet: 'bg-violet-50  dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    sky:    'bg-sky-50     dark:bg-sky-900/20    text-sky-600    dark:text-sky-400',
  };
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </>
  );
  const cls = `${cardCls} flex items-center gap-3 hover:shadow-md transition-shadow`;
  return to
    ? <Link to={to} className={cls}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

// ─── Section Header ───────────────────────────────────────────
function SectionHeader({ title, sub, to }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {to && <Link to={to} className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium">View all →</Link>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [stats,  setStats]  = useState(null);
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    api.get('/settings/dashboard').then(r => setStats(r.data)).catch(() => {});
    api.get('/settings/dashboard/charts').then(r => setCharts(r.data)).catch(() => {});
  }, []);

  const salesCards = useMemo(() => {
    const ss = charts?.sales_stats || {};
    return [
      { icon: '💼', label: 'Total Sales',    value: fmtINR(ss.total_sales),      color: 'brand',  to: '/sales?tab=invoices' },
      { icon: '✅', label: 'Paid Amount',    value: fmtINR(ss.paid_amount),      color: 'green',  to: '/sales?tab=invoices' },
      { icon: '❌', label: 'Unpaid Amount',  value: fmtINR(ss.unpaid_amount),    color: 'red',    to: '/sales?tab=invoices' },
      { icon: '⏳', label: 'Partial',        value: fmtINR(ss.partial_amount),   color: 'amber',  to: '/sales?tab=invoices' },
      { icon: '🧾', label: 'Total Invoices', value: fmtNum(ss.total_invoices),   color: 'violet', to: '/sales?tab=invoices' },
      { icon: '👥', label: 'Customers',      value: fmtNum(ss.unique_customers), color: 'sky',    to: '/sales?tab=customers' },
    ];
  }, [charts]);

  const crmCards = useMemo(() => [
    { icon: '📊', label: 'Total Leads',   value: fmtNum(stats?.open_leads),      color: 'brand',  to: '/crm?tab=list',       sub: 'Open leads' },
    { icon: '💰', label: 'Revenue (MTD)', value: fmtINR(stats?.revenue),         color: 'green',  to: '/sales?tab=invoices', sub: 'Paid invoices' },
    { icon: '📦', label: 'Active Orders', value: fmtNum(stats?.active_orders),   color: 'amber',  to: '/sales?tab=orders',   sub: 'In progress' },
    { icon: '👤', label: 'Employees',     value: fmtNum(stats?.total_employees), color: 'violet', to: '/hr',                 sub: 'Total staff' },
  ], [stats]);

  const fyLabel = charts ? `${charts.fy_current} vs ${charts.fy_prev}` : 'Yearly Comparison';

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">
          Good {greeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Here's your business overview for today</p>
      </div>

      {/* Sales Overview KPIs */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Sales Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {salesCards.map(c => <KpiCard key={c.label} {...c} />)}
        </div>
      </div>

      {/* CRM / HR KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {crmCards.map(c => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Yearly Sales Comparison Bar Chart */}
      <div className={cardCls}>
        <SectionHeader title="Yearly Sales Comparison" sub={fyLabel} to="/sales?tab=invoices" />
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts?.monthly_comparison || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={fmtINRShort} tick={{ fontSize: 10 }} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="current" name={charts?.fy_current || 'Current FY'} fill="#534AB7" radius={[3,3,0,0]} />
              <Bar dataKey="prev"    name={charts?.fy_prev    || 'Prev FY'}    fill="#1D9E75" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-wise Sales Amount Comparison Table */}
      <div className={cardCls}>
        <SectionHeader title="Month-wise Sales Amount Comparison" sub={fyLabel} to="/sales?tab=invoices" />
        {charts?.monthly_comparison?.length ? (() => {
          const rows = charts.monthly_comparison;
          const totCur  = rows.reduce((s, r) => s + r.current, 0);
          const totPrev = rows.reduce((s, r) => s + r.prev, 0);
          const totDiff = totCur - totPrev;
          const totChg  = totPrev > 0 ? ((totDiff / totPrev) * 100) : 0;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Month</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-[#534AB7] dark:text-indigo-400 uppercase tracking-wide">{charts.fy_current}</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-[#1D9E75] dark:text-emerald-400 uppercase tracking-wide">{charts.fy_prev}</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Difference</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Change %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {rows.map((r, i) => {
                    const diff = r.current - r.prev;
                    const chg  = r.prev > 0 ? ((diff / r.prev) * 100) : (r.current > 0 ? 100 : 0);
                    const up   = diff >= 0;
                    return (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{r.month}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#534AB7] dark:text-indigo-400">{fmtINR(r.current)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1D9E75] dark:text-emerald-400">{fmtINR(r.prev)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {up ? '+' : ''}{fmtINR(diff)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                               : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {up ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 uppercase text-[11px] tracking-wide">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#534AB7] dark:text-indigo-400">{fmtINR(totCur)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#1D9E75] dark:text-emerald-400">{fmtINR(totPrev)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${totDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {totDiff >= 0 ? '+' : ''}{fmtINR(totDiff)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        totChg >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {totChg >= 0 ? '▲' : '▼'} {Math.abs(totChg).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })() : (
          <p className="text-center py-8 text-slate-400 text-xs">No comparison data available</p>
        )}
      </div>

      {/* Client-wise Monthly Sales Report */}
      <div className={cardCls}>
        <SectionHeader title="Client-wise Monthly Sales Report" sub={charts?.fy_current} to="/sales?tab=customers" />
        {charts?.client_monthly?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide sticky left-0 bg-white dark:bg-[#13152a]">Customer</th>
                  {(charts.month_labels || []).map(m => (
                    <th key={m} className="px-2 py-2 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {charts.client_monthly.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap sticky left-0 bg-white dark:bg-[#13152a]">{row.customer}</td>
                    {row.months.map((amt, j) => (
                      <td key={j} className={`px-2 py-2 text-right tabular-nums ${amt > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                        {amt > 0 ? fmtINRShort(amt) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-brand-600 dark:text-brand-400 tabular-nums whitespace-nowrap">{fmtINR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-slate-400 text-xs">No client sales data available for this period</p>
        )}
      </div>

      {/* Recent Buyers + Recent Invoices */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <SectionHeader title="Recent Buyers" sub="Top customers by total spend" to="/sales?tab=customers" />
          {charts?.recent_buyers?.length ? (
            <div className="space-y-1">
              {charts.recent_buyers.map((b, i) => {
                const maxSpend = charts.recent_buyers[0]?.total_spent || 1;
                const pct = Math.round((b.total_spent / maxSpend) * 100);
                return (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-700/40 last:border-0">
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">{b.name}</span>
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums flex-shrink-0">{fmtINRShort(b.total_spent)}</span>
                      </div>
                      <div className="h-[4px] bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px] text-slate-400">{b.invoice_count} invoice{b.invoice_count !== 1 ? 's' : ''}</span>
                        <span className="text-[9px] text-slate-400">Last: {fmtD(b.last_purchase)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-400 text-xs">No buyer data yet</p>
          )}
        </div>

        <div className={cardCls}>
          <SectionHeader title="Recent Invoices" to="/sales?tab=invoices" />
          {charts?.recent_invoices?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[360px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50">
                    {['Invoice #', 'Customer', 'Amount', 'Balance', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {charts.recent_invoices.map((inv, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-2 py-2 font-mono font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-200 max-w-[100px] truncate">{inv.customer_name}</td>
                      <td className="px-2 py-2 tabular-nums font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmtINR(inv.total_amount)}</td>
                      <td className="px-2 py-2 tabular-nums text-amber-600 whitespace-nowrap">{fmtINR(inv.balance)}</td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_CLS[inv.status] || STATUS_CLS.pending}`}>{inv.status}</span>
                      </td>
                      <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{fmtD(inv.invoice_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-400 text-xs">No invoices yet</p>
          )}
        </div>
      </div>

      {/* Low Stock + Lead Sources + Tasks */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={cardCls}>
          <SectionHeader title="Low Stock Items" to="/inventory?tab=products" />
          {charts?.low_stock_items?.length ? (
            <div className="space-y-1">
              {charts.low_stock_items.map((item, i) => {
                const danger = item.stock <= 0;
                const warn   = !danger && item.stock <= item.low_stock_alert;
                const cls    = danger ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                             : warn   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                             :          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/40 last:border-0 gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                      {item.sku && <p className="text-[9px] text-slate-400 font-mono">{item.sku}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ${cls}`}>{item.stock} left</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-400 text-xs">All items sufficiently stocked</p>
          )}
        </div>

        <div className={cardCls}>
          <SectionHeader title="Lead Sources" to="/crm?tab=list" />
          {[
            ['Meta Ads', 72, '#534AB7'],
            ['Google Ads', 48, '#1D9E75'],
            ['Website', 35, '#BA7517'],
            ['G-Sheet', 18, '#E24B4A'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center gap-2 mb-2.5 text-[11px]">
              <div className="w-20 text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</div>
              <div className="flex-1 h-[5px] bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
              </div>
              <div className="w-8 text-right font-semibold text-slate-700 dark:text-slate-200">{value}%</div>
            </div>
          ))}
        </div>

        <div className={cardCls}>
          <SectionHeader title="Today's Tasks" to="/crm?tab=followups" />
          <div className="space-y-2 text-[11px]">
            {[
              ["Call - Ravi Kumar 10:00 AM",    "Due",      STATUS_CLS.pending],
              ["Email - Priya Sharma 11:30 AM", "Done",     STATUS_CLS.paid],
              ["Meeting - TechCorp 3:00 PM",    "Upcoming", "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"],
            ].map(([task, status, cls]) => (
              <Link key={task} to="/crm?tab=followups"
                className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/40 pb-2 last:border-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-400 transition-colors no-underline">
                <span className="text-slate-700 dark:text-slate-200 pr-2 truncate">{task}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ${cls}`}>{status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
