import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const kpiCardCls =
  'block bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-3.5 ' +
  'hover:border-brand-300 dark:hover:border-brand-600/40 hover:shadow-md transition-shadow ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0d0f1a]';

const rowLinkCls =
  'flex items-center rounded-lg -mx-1 px-1 -my-0.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/settings/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
  const cards = useMemo(
    () => [
      {
        label: 'Total Leads',
        to: '/crm?tab=list',
        value: fmt(stats?.open_leads),
        sub: '12% this month',
        subCls: 'text-[#1D9E75]',
      },
      {
        label: 'Revenue (MTD)',
        to: '/sales/invoices',
        value: `₹${fmt(stats?.revenue)}`,
        sub: '8% vs last month',
        subCls: 'text-[#1D9E75]',
      },
      {
        label: 'Active Orders',
        to: '/sales/orders',
        value: fmt(stats?.active_orders),
        sub: 'In progress',
        subCls: 'text-slate-400',
      },
      {
        label: 'Employees',
        to: '/hr',
        value: fmt(stats?.total_employees),
        sub: 'Total staff',
        subCls: 'text-slate-400',
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Good {greeting()}, {user?.name?.split(' ')[0]}</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={kpiCardCls}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-[22px] font-semibold text-slate-800 dark:text-slate-100 mt-1">{c.value}</div>
            <div className={`text-[10px] mt-0.5 ${c.subCls}`}>{c.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <Link
            to="/crm?tab=list"
            className="inline-block text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-3 hover:text-brand-600 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Lead sources
          </Link>
          {[
            ['Meta Ads', 72, '#534AB7'],
            ['Google Ads', 48, '#1D9E75'],
            ['Website', 35, '#BA7517'],
            ['G-Sheet', 18, '#E24B4A'],
          ].map(([label, value, color]) => (
            <Link
              key={label}
              to="/crm?tab=list"
              className={`${rowLinkCls} gap-2 mb-2 text-[11px] no-underline text-inherit`}
            >
              <div className="w-20 text-slate-500 dark:text-slate-400 shrink-0">{label}</div>
              <div className="flex-1 h-[5px] bg-[#eeecea] dark:bg-slate-700 rounded overflow-hidden min-w-0">
                <div className="h-full rounded" style={{ width: `${value}%`, background: color }} />
              </div>
              <div className="w-9 text-right font-semibold text-slate-700 dark:text-slate-200 shrink-0">{value}%</div>
            </Link>
          ))}
        </div>

        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <Link
            to="/crm?tab=followups"
            className="inline-block text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-3 hover:text-brand-600 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Today&apos;s tasks
          </Link>
          <div className="space-y-2 text-[11px]">
            {[
              ['Call - Ravi Kumar 10:00 AM', 'Due', 'bg-[#FAEEDA] text-[#633806]'],
              ['Email - Priya Sharma 11:30 AM', 'Done', 'bg-[#EAF3DE] text-[#27500A]'],
              ['Meeting - TechCorp 3:00 PM', 'Upcoming', 'bg-[#E6F1FB] text-[#0C447C]'],
            ].map(([task, status, cls]) => (
              <Link
                key={task}
                to="/crm?tab=followups"
                className={`${rowLinkCls} items-center justify-between border-b border-slate-200 dark:border-slate-700/40 pb-1.5 mb-0 rounded-none no-underline text-inherit`}
              >
                <span className="text-slate-700 dark:text-slate-200 pr-2">{task}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cls}`}>{status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <Link
            to="/crm?tab=list"
            className="inline-block text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2 hover:text-brand-600 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Executive performance
          </Link>
          {[
            ['Arjun R.', '48', '62%'],
            ['Sneha P.', '39', '55%'],
            ['Karan M.', '31', '41%'],
          ].map(([name, leads, conv]) => (
            <Link
              key={name}
              to="/crm?tab=list"
              className={`${rowLinkCls} justify-between text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0 rounded-none no-underline text-inherit gap-2`}
            >
              <span className="text-slate-700 dark:text-slate-200 truncate min-w-0">{name}</span>
              <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{leads}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">{conv}</span>
            </Link>
          ))}
        </div>
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <Link
            to="/inventory?tab=products"
            className="inline-block text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2 hover:text-brand-600 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Inventory alerts
          </Link>
          {[
            ['Widget Pro X', '3 left', 'bg-[#FCEBEB] text-[#791F1F]'],
            ['Smart Sensor B', '8 left', 'bg-[#FAEEDA] text-[#633806]'],
            ['Cable Pack Pro', '42 left', 'bg-[#EAF3DE] text-[#27500A]'],
          ].map(([item, stock, cls]) => (
            <Link
              key={item}
              to="/inventory?tab=products"
              className={`${rowLinkCls} justify-between items-center text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0 rounded-none no-underline text-inherit`}
            >
              <span className="text-slate-700 dark:text-slate-200 pr-2 truncate min-w-0">{item}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cls}`}>{stock}</span>
            </Link>
          ))}
        </div>
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <Link
            to="/sales/invoices"
            className="inline-block text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2 hover:text-brand-600 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Recent invoices
          </Link>
          {[
            ['INV-2024', '₹2,40,000', 'Paid', 'bg-[#EAF3DE] text-[#27500A]'],
            ['INV-2025', '₹85,500', 'Pending', 'bg-[#FAEEDA] text-[#633806]'],
            ['INV-2026', '₹23,000', 'Overdue', 'bg-[#FCEBEB] text-[#791F1F]'],
          ].map(([inv, amt, status, cls]) => (
            <Link
              key={inv}
              to="/sales/invoices"
              className={`${rowLinkCls} justify-between items-center text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0 rounded-none no-underline text-inherit`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-slate-700 dark:text-slate-200 font-semibold">{inv}</div>
                <div className="text-slate-500 dark:text-slate-400">{amt}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cls}`}>{status}</span>
            </Link>
          ))}
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
