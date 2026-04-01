import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ label, value, gradient, icon, sub }) => (
  <div className={`rounded-2xl p-5 text-white relative overflow-hidden shadow-sm ${gradient}`}>
    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
    <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white/10" />
    <div className="relative">
      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg mb-3">
        {icon}
      </div>
      <p className="text-xs font-medium text-white/70 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
    </div>
  </div>
);

const quickLinks = [
  { to: '/crm',        label: 'CRM',          desc: 'Leads & pipeline',      icon: '◎', light: 'bg-violet-50 border-violet-200 hover:border-violet-400',   dark: 'dark:bg-violet-900/10 dark:border-violet-800 dark:hover:border-violet-500',   iconCls: 'text-violet-500 dark:text-violet-400' },
  { to: '/sales',      label: 'Sales',        desc: 'Orders & invoices',     icon: '◈', light: 'bg-blue-50 border-blue-200 hover:border-blue-400',           dark: 'dark:bg-blue-900/10 dark:border-blue-800 dark:hover:border-blue-500',         iconCls: 'text-blue-500 dark:text-blue-400' },
  { to: '/purchase',   label: 'Purchase',     desc: 'Vendors & POs',         icon: '⊕', light: 'bg-amber-50 border-amber-200 hover:border-amber-400',        dark: 'dark:bg-amber-900/10 dark:border-amber-800 dark:hover:border-amber-500',      iconCls: 'text-amber-500 dark:text-amber-400' },
  { to: '/inventory',  label: 'Inventory',    desc: 'Products & stock',      icon: '◫', light: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',  dark: 'dark:bg-emerald-900/10 dark:border-emerald-800 dark:hover:border-emerald-500', iconCls: 'text-emerald-500 dark:text-emerald-400' },
  { to: '/finance',    label: 'Finance',      desc: 'Accounts & journals',   icon: '◑', light: 'bg-rose-50 border-rose-200 hover:border-rose-400',           dark: 'dark:bg-rose-900/10 dark:border-rose-800 dark:hover:border-rose-500',         iconCls: 'text-rose-500 dark:text-rose-400' },
  { to: '/hr',         label: 'HR & Payroll', desc: 'Employees & attendance',icon: '◉', light: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',     dark: 'dark:bg-indigo-900/10 dark:border-indigo-800 dark:hover:border-indigo-500',   iconCls: 'text-indigo-500 dark:text-indigo-400' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/settings/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const fmt = n => Number(n || 0).toLocaleString('en-IN');

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          Good {greeting()}, <span className="text-brand-600 dark:text-brand-400">{user?.name?.split(' ')[0]}</span> 👋
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Here's what's happening across your business today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Open Leads"    value={fmt(stats?.open_leads)}      gradient="bg-gradient-to-br from-violet-500 to-purple-600"  icon="◎" sub="Active pipeline" />
        <StatCard label="Revenue"       value={`₹${fmt(stats?.revenue)}`}  gradient="bg-gradient-to-br from-emerald-500 to-teal-600"   icon="◈" sub="Paid invoices" />
        <StatCard label="Active Orders" value={fmt(stats?.active_orders)}   gradient="bg-gradient-to-br from-amber-500 to-orange-500"   icon="◫" sub="In progress" />
        <StatCard label="Employees"     value={fmt(stats?.total_employees)} gradient="bg-gradient-to-br from-brand-500 to-brand-700"    icon="◉" sub="Total staff" />
      </div>

      {/* Quick access */}
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
        Quick Access
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quickLinks.map(({ to, label, desc, icon, light, dark, iconCls }) => (
          <Link key={to} to={to}
            className={`group bg-white dark:bg-[#1a1d2e] rounded-2xl p-4 border transition-all duration-150 shadow-card hover:shadow-card-hover ${light} ${dark}`}>
            <div className="flex items-start gap-3">
              <span className={`text-xl mt-0.5 ${iconCls}`}>{icon}</span>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
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
