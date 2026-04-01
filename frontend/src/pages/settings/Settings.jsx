import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import { Field, inputCls } from '../../components/FormField';

// ─── Constants ───────────────────────────────────────────────

const ALL_ROLES = ['Super Admin', 'Admin', 'Manager', 'Agent', 'Accountant', 'HR'];

const ROLE_COLORS = {
  'Super Admin': 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Manager:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Accountant:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  HR:            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Agent:         'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const MODULE_ICONS = {
  crm:           '◎',
  sales:         '◈',
  purchase:      '⊕',
  inventory:     '◫',
  production:    '⚙',
  finance:       '◑',
  hr:            '◉',
  communication: '◐',
  settings:      '◌',
  users:         '◈',
};

// ─── Company Tab ─────────────────────────────────────────────

function CompanyTab({ user }) {
  const [form,  setForm]  = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings/company').then(r => setForm(r.data || {})).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    await api.patch('/settings/company', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-6 max-w-xl">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-5">Company Profile</h3>

      {saved && (
        <div className="mb-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm rounded-xl">
          Settings saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {[
          ['Company Name', 'company_name', 'text'],
          ['GSTIN',        'gstin',        'text'],
          ['Phone',        'phone',        'text'],
          ['Email',        'email',        'email'],
          ['Currency',     'currency',     'text'],
        ].map(([label, key, type]) => (
          <Field key={key} label={label}>
            <input className={inputCls} type={type} value={form[key] || ''} onChange={set(key)} />
          </Field>
        ))}

        <Field label="Address">
          <textarea className={inputCls} rows={3} value={form.address || ''} onChange={set('address')} />
        </Field>

        <Field label="Fiscal Year Start">
          <input className={inputCls} type="date" value={form.fiscal_year_start || ''} onChange={set('fiscal_year_start')} />
        </Field>

        {(user?.role === 'Admin' || user?.role === 'Super Admin') && (
          <button type="submit"
            className="bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700
                       text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-[0.98]">
            Save Settings
          </button>
        )}
      </form>
    </div>
  );
}

// ─── Modules Tab ─────────────────────────────────────────────

function ModulesTab() {
  const [modules,  setModules]  = useState([]);
  const [saving,   setSaving]   = useState(null); // module key being saved

  const load = useCallback(() => {
    api.get('/settings/modules').then(r => setModules(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = async (mod) => {
    setSaving(mod.module);
    try {
      await api.patch(`/settings/modules/${mod.module}`, { is_enabled: !mod.is_enabled });
      load();
    } finally { setSaving(null); }
  };

  const toggleRole = async (mod, role) => {
    const current = mod.allowed_roles || [];
    const next = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    // Always keep Super Admin
    const safe = next.includes('Super Admin') ? next : ['Super Admin', ...next];
    setSaving(mod.module + ':' + role);
    try {
      await api.patch(`/settings/modules/${mod.module}`, { allowed_roles: safe });
      load();
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Enable or disable modules, and control which roles can access them.
        Super Admin always has full access.
      </p>

      {modules.map(mod => (
        <div key={mod.module}
          className={`bg-white dark:bg-[#1a1d2e] rounded-2xl border shadow-card transition-all
            ${mod.is_enabled
              ? 'border-slate-200/80 dark:border-slate-700/50'
              : 'border-slate-200/40 dark:border-slate-700/30 opacity-60'}`}>

          {/* Header row */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/40">
            {/* Icon + label */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0
              ${mod.is_enabled
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              {MODULE_ICONS[mod.module] || '◆'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mod.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{mod.module}</p>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className={`text-xs font-medium ${mod.is_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {mod.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => toggleEnabled(mod)}
                disabled={saving === mod.module}
                className={`relative flex items-center w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60
                  ${mod.is_enabled ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200
                  ${mod.is_enabled ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
          </div>

          {/* Role access row */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">
              Access
            </span>
            {ALL_ROLES.map(role => {
              const isOn     = (mod.allowed_roles || []).includes(role);
              const locked   = role === 'Super Admin';
              const isSaving = saving === `${mod.module}:${role}`;
              return (
                <button
                  key={role}
                  onClick={() => !locked && toggleRole(mod, role)}
                  disabled={locked || isSaving || !mod.is_enabled}
                  title={locked ? 'Super Admin always has access' : isOn ? 'Click to revoke access' : 'Click to grant access'}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 border
                    ${locked
                      ? `${ROLE_COLORS[role]} opacity-80 cursor-default`
                      : isOn
                        ? `${ROLE_COLORS[role]} hover:opacity-80 cursor-pointer`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-transparent hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                    } ${!mod.is_enabled ? 'pointer-events-none' : ''} ${isSaving ? 'opacity-50' : ''}`}>
                  {isOn && !locked && <span className="mr-0.5">✓</span>}
                  {role}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit Logs Tab ──────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/settings/audit-logs').then(r => setLogs(r.data || [])).catch(() => {});
  }, []);

  return (
    <Table
      cols={['Date', 'User', 'Action', 'Module', 'Record ID']}
      rows={logs.map(l => [
        l.created_at?.slice(0, 16),
        l.user_name || '—',
        l.action,
        l.module   || '—',
        l.record_id || '—',
      ])}
      empty="No audit logs"
    />
  );
}

// ─── Root Page ───────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'Admin' || user?.role === 'Super Admin';

  const tabs = isAdmin ? ['Company', 'Modules', 'Audit Logs'] : ['Company'];
  const [tab, setTab] = useState('Company');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Company profile, module access, and system logs
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Company'    && <CompanyTab user={user} />}
      {tab === 'Modules'    && <ModulesTab />}
      {tab === 'Audit Logs' && <AuditTab />}
    </div>
  );
}
