import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/settings/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
  const cards = useMemo(
    () => [
      { label: 'Total Leads', value: fmt(stats?.open_leads), sub: '12% this month', subCls: 'text-[#1D9E75]' },
      { label: 'Revenue (MTD)', value: `₹${fmt(stats?.revenue)}`, sub: '8% vs last month', subCls: 'text-[#1D9E75]' },
      { label: 'Active Orders', value: fmt(stats?.active_orders), sub: 'In progress', subCls: 'text-slate-400' },
      { label: 'Employees', value: fmt(stats?.total_employees), sub: 'Total staff', subCls: 'text-slate-400' },
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
          <div key={c.label} className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-[22px] font-semibold text-slate-800 dark:text-slate-100 mt-1">{c.value}</div>
            <div className={`text-[10px] mt-0.5 ${c.subCls}`}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-3">Lead sources</div>
          {[
            ['Meta Ads', 72, '#534AB7'],
            ['Google Ads', 48, '#1D9E75'],
            ['Website', 35, '#BA7517'],
            ['G-Sheet', 18, '#E24B4A'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center gap-2 mb-2 text-[11px]">
              <div className="w-20 text-slate-500 dark:text-slate-400">{label}</div>
              <div className="flex-1 h-[5px] bg-[#eeecea] dark:bg-slate-700 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${value}%`, background: color }} />
              </div>
              <div className="w-9 text-right font-semibold text-slate-700 dark:text-slate-200">{value}%</div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-3">Today's tasks</div>
          <div className="space-y-2 text-[11px]">
            {[
              ['Call - Ravi Kumar 10:00 AM', 'Due', 'bg-[#FAEEDA] text-[#633806]'],
              ['Email - Priya Sharma 11:30 AM', 'Done', 'bg-[#EAF3DE] text-[#27500A]'],
              ['Meeting - TechCorp 3:00 PM', 'Upcoming', 'bg-[#E6F1FB] text-[#0C447C]'],
            ].map(([task, status, cls]) => (
              <div key={task} className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/40 pb-1.5">
                <span className="text-slate-700 dark:text-slate-200">{task}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2">Executive performance</div>
          {[
            ['Arjun R.', '48', '62%'],
            ['Sneha P.', '39', '55%'],
            ['Karan M.', '31', '41%'],
          ].map(([name, leads, conv]) => (
            <div key={name} className="flex justify-between text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0">
              <span className="text-slate-700 dark:text-slate-200">{name}</span>
              <span className="text-slate-500 dark:text-slate-400">{leads}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{conv}</span>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2">Inventory alerts</div>
          {[
            ['Widget Pro X', '3 left', 'bg-[#FCEBEB] text-[#791F1F]'],
            ['Smart Sensor B', '8 left', 'bg-[#FAEEDA] text-[#633806]'],
            ['Cable Pack Pro', '42 left', 'bg-[#EAF3DE] text-[#27500A]'],
          ].map(([item, stock, cls]) => (
            <div key={item} className="flex justify-between items-center text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0">
              <span className="text-slate-700 dark:text-slate-200">{item}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{stock}</span>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-[#13152a] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-2">Recent invoices</div>
          {[
            ['INV-2024', '₹2,40,000', 'Paid', 'bg-[#EAF3DE] text-[#27500A]'],
            ['INV-2025', '₹85,500', 'Pending', 'bg-[#FAEEDA] text-[#633806]'],
            ['INV-2026', '₹23,000', 'Overdue', 'bg-[#FCEBEB] text-[#791F1F]'],
          ].map(([inv, amt, status, cls]) => (
            <div key={inv} className="flex justify-between items-center text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700/40 last:border-b-0">
              <div>
                <div className="text-slate-700 dark:text-slate-200 font-semibold">{inv}</div>
                <div className="text-slate-500 dark:text-slate-400">{amt}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{status}</span>
            </div>
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
