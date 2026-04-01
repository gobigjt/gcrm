import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

// ─── Constants ──────────────────────────────────────────────

const MODULE_ORDER = [
  'crm','sales','purchase','inventory','production',
  'finance','hr','communication','settings','users',
];
const MODULE_LABELS = {
  crm:'CRM', sales:'Sales', purchase:'Purchase', inventory:'Inventory',
  production:'Production', finance:'Finance', hr:'HR & Payroll',
  communication:'Communication', settings:'Settings', users:'Users',
};

// Paired display order: [base, all] — shown as twin pills
const ACTION_PAIRS = [
  ['view',   'view_all'],
  ['create', 'create_all'],
  ['edit',   'edit_all'],
  ['delete', 'delete_all'],
];

const ACTION_META = {
  view:       { label: 'View',        color: 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' },
  view_all:   { label: 'View All',    color: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700' },
  create:     { label: 'Create',      color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  create_all: { label: 'Create All',  color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
  edit:       { label: 'Edit',        color: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
  edit_all:   { label: 'Edit All',    color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
  delete:     { label: 'Delete',      color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  delete_all: { label: 'Delete All',  color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
};

const OFF_CLS = 'bg-slate-100 text-slate-400 border-transparent dark:bg-slate-800 dark:text-slate-600';

const ROLE_COLORS = {
  'Super Admin': 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Manager:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Accountant:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  HR:            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Agent:         'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

// ─── Helpers ────────────────────────────────────────────────

const RoleBadge = ({ role }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[role] ?? ROLE_COLORS.Agent}`}>
    {role}
  </span>
);

const StatusBadge = ({ active }) => active
  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</span>
  : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Disabled</span>;

// ─── Permission Grid Component ───────────────────────────────

function PermGrid({ allPerms, selected, onChange, readOnly = false }) {
  // Build lookup: module → { action → permObj }
  const byModule = {};
  for (const p of allPerms) {
    if (!byModule[p.module]) byModule[p.module] = {};
    byModule[p.module][p.action] = p;
  }

  const selectedSet = new Set(selected);

  const toggle = (id) => {
    if (readOnly || id == null) return;
    const next = selectedSet.has(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next);
  };

  const togglePair = ([base, all]) => {
    if (readOnly) return;
    const module = allPerms.find(p => p.action === base || p.action === all)?.module;
    const ids = [byModule[module]?.[base]?.id, byModule[module]?.[all]?.id].filter(Boolean);
    const allOn = ids.every(id => selectedSet.has(id));
    onChange(allOn
      ? selected.filter(id => !ids.includes(id))
      : [...new Set([...selected, ...ids])]);
  };

  const toggleModule = (module) => {
    if (readOnly) return;
    const ids = Object.values(byModule[module] ?? {}).map(p => p.id);
    const allOn = ids.every(id => selectedSet.has(id));
    onChange(allOn
      ? selected.filter(id => !ids.includes(id))
      : [...new Set([...selected, ...ids])]);
  };

  const allIds  = allPerms.map(p => p.id);
  const allOn   = allIds.length > 0 && allIds.every(id => selectedSet.has(id));

  const toggleAll = () => {
    if (readOnly) return;
    onChange(allOn ? [] : allIds);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">

      {/* Select-all header */}
      {!readOnly && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allOn} onChange={toggleAll} className="w-4 h-4 rounded accent-indigo-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Select All</span>
          </label>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
            {selected.length} / {allIds.length}
          </span>
        </div>
      )}

      {/* Column headers */}
      <div className="grid border-b border-slate-200 dark:border-slate-700"
           style={{ gridTemplateColumns: '160px repeat(4, 1fr)' }}>
        <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/40" />
        {ACTION_PAIRS.map(([base]) => (
          <div key={base} className="px-2 py-2 text-center bg-slate-50/80 dark:bg-slate-800/40">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {ACTION_META[base].label.replace(' ', '\u00A0')}
            </span>
          </div>
        ))}
      </div>

      {/* Module rows */}
      {MODULE_ORDER.filter(m => byModule[m]).map((module, mi) => {
        const modPerms  = byModule[module];
        const modIds    = Object.values(modPerms).map(p => p.id);
        const modAllOn  = modIds.every(id => selectedSet.has(id));
        const modSomeOn = modIds.some(id => selectedSet.has(id)) && !modAllOn;

        return (
          <div key={module}
               className={`grid border-b border-slate-100 dark:border-slate-700/40 last:border-0 ${mi % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/10'}`}
               style={{ gridTemplateColumns: '160px repeat(4, 1fr)' }}>

            {/* Module label + row-select */}
            <div className="flex items-center gap-2 px-4 py-3">
              {!readOnly && (
                <input type="checkbox" checked={modAllOn}
                  ref={el => { if (el) el.indeterminate = modSomeOn; }}
                  onChange={() => toggleModule(module)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {MODULE_LABELS[module] ?? module}
              </span>
            </div>

            {/* 4 paired columns */}
            {ACTION_PAIRS.map(([base, all]) => {
              const bPerm = modPerms[base];
              const aPerm = modPerms[all];
              const bOn   = bPerm && selectedSet.has(bPerm.id);
              const aOn   = aPerm && selectedSet.has(aPerm.id);

              return (
                <div key={base} className="flex flex-col gap-1 px-2 py-2 items-center justify-center">
                  {/* base pill */}
                  <label className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all w-full justify-center
                    ${readOnly
                      ? bOn ? ACTION_META[base].color : OFF_CLS
                      : `cursor-pointer ${bOn ? ACTION_META[base].color : OFF_CLS} ${!readOnly ? 'hover:border-slate-300 dark:hover:border-slate-600' : ''}`
                    }`}>
                    {!readOnly && bPerm && (
                      <input type="checkbox" checked={!!bOn} onChange={() => toggle(bPerm?.id)}
                        className="w-3 h-3 rounded accent-indigo-500" />
                    )}
                    {ACTION_META[base].label}
                  </label>
                  {/* all pill */}
                  <label className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all w-full justify-center
                    ${readOnly
                      ? aOn ? ACTION_META[all].color : OFF_CLS
                      : `cursor-pointer ${aOn ? ACTION_META[all].color : OFF_CLS} ${!readOnly ? 'hover:border-slate-300 dark:hover:border-slate-600' : ''}`
                    }`}>
                    {!readOnly && aPerm && (
                      <input type="checkbox" checked={!!aOn} onChange={() => toggle(aPerm?.id)}
                        className="w-3 h-3 rounded accent-indigo-500" />
                    )}
                    {ACTION_META[all].label}
                  </label>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────

function UsersTab({ allPerms, roles }) {
  const [users,  setUsers]  = useState([]);
  const [saving, setSaving] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [permModal,   setPermModal]   = useState(null);

  const [cForm, setCForm] = useState({ name:'', email:'', password:'', role:'Agent' });
  const [eForm, setEForm] = useState({ name:'', email:'', role:'Agent', newPassword:'' });

  const load = useCallback(() =>
    api.get('/users').then(r => setUsers(r.data || [])).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const setC = k => e => setCForm(f => ({ ...f, [k]: e.target.value }));
  const setE = k => e => setEForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/users', cForm); setCreateModal(false); setCForm({ name:'', email:'', password:'', role:'Agent' }); load(); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    const payload = { name: eForm.name, email: eForm.email, role: eForm.role };
    if (eForm.newPassword) payload.password = eForm.newPassword;
    try { await api.patch(`/users/${editModal.id}`, payload); setEditModal(null); load(); }
    finally { setSaving(false); }
  };

  const openEdit = (u) => {
    setEForm({ name: u.name, email: u.email, role: u.role, newPassword: '' });
    setEditModal(u);
  };

  const openPerms = async (u) => {
    const r = await api.get(`/users/${u.id}/permissions`);
    setPermModal({
      user: u,
      rolePermIds: r.data.role_permissions.map(p => p.id),
      userPermIds: r.data.user_permissions.map(p => p.id),
    });
  };

  const handleSavePerms = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${permModal.user.id}/permissions`, { permission_ids: permModal.userPermIds });
      setPermModal(null); load();
    } finally { setSaving(false); }
  };

  const handleToggle = async (u) => {
    await api.patch(`/users/${u.id}/toggle-status`); load();
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700
                     text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98]">
          + New User
        </button>
      </div>

      <Table
        cols={['User', 'Role', 'Overrides', 'Status', 'Joined', 'Actions']}
        rows={users.map(u => [
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {u.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{u.name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
          </div>,
          <RoleBadge role={u.role} />,
          <button onClick={() => openPerms(u)}
            className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
            <span className="w-5 h-5 rounded-md bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold">
              {Number(u.extra_permissions) > 0 ? `+${u.extra_permissions}` : '○'}
            </span>
            {Number(u.extra_permissions) > 0 ? `${u.extra_permissions} override${u.extra_permissions > 1 ? 's' : ''}` : 'Role default'}
          </button>,
          <StatusBadge active={u.is_active} />,
          u.created_at?.slice(0, 10),
          <div className="flex items-center gap-1.5">
            <button onClick={() => openEdit(u)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
              Edit
            </button>
            <button onClick={() => handleToggle(u)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all
                ${u.is_active
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100'
                  : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100'}`}>
              {u.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>,
        ])}
        empty="No users found"
      />

      {/* ── Create User Modal ── */}
      {createModal && (
        <Modal title="New User" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *">
                <input className={inputCls} value={cForm.name} onChange={setC('name')} required placeholder="John Smith" />
              </Field>
              <Field label="Email *">
                <input className={inputCls} type="email" value={cForm.email} onChange={setC('email')} required placeholder="john@company.com" />
              </Field>
              <Field label="Password *">
                <input className={inputCls} type="password" value={cForm.password} onChange={setC('password')} required minLength={6} placeholder="Min 6 characters" />
              </Field>
              <Field label="Role">
                <select className={selectCls} value={cForm.role} onChange={setC('role')}>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
            </div>
            <FormActions onCancel={() => setCreateModal(false)} submitLabel="Create User" loading={saving} />
          </form>
        </Modal>
      )}

      {/* ── Edit User Modal ── */}
      {editModal && (
        <Modal title={`Edit — ${editModal.name}`} onClose={() => setEditModal(null)}>
          <form onSubmit={handleEdit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *">
                <input className={inputCls} value={eForm.name} onChange={setE('name')} required />
              </Field>
              <Field label="Email *">
                <input className={inputCls} type="email" value={eForm.email} onChange={setE('email')} required />
              </Field>
              <Field label="Role">
                <select className={selectCls} value={eForm.role} onChange={setE('role')}>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="New Password">
                <input className={inputCls} type="password" value={eForm.newPassword} onChange={setE('newPassword')} placeholder="Leave blank to keep" minLength={6} />
              </Field>
            </div>
            <FormActions onCancel={() => setEditModal(null)} submitLabel="Save Changes" loading={saving} />
          </form>
        </Modal>
      )}

      {/* ── User Permissions Modal ── */}
      {permModal && (
        <Modal title={`Permissions — ${permModal.user.name}`} onClose={() => setPermModal(null)}>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Inherited from role · <RoleBadge role={permModal.user.role} />
              </p>
              <PermGrid allPerms={allPerms} selected={permModal.rolePermIds} onChange={() => {}} readOnly />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                User-specific overrides
              </p>
              <PermGrid
                allPerms={allPerms}
                selected={permModal.userPermIds}
                onChange={ids => setPermModal(m => ({ ...m, userPermIds: ids }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/50">
            <button onClick={() => setPermModal(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 rounded-xl transition-all">
              Cancel
            </button>
            <button onClick={handleSavePerms} disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:opacity-60 rounded-xl shadow-sm transition-all">
              {saving ? 'Saving…' : 'Save Overrides'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Roles Tab ───────────────────────────────────────────────

function RolesTab({ allPerms, onReload }) {
  const [roles,  setRoles]  = useState([]);
  const [saving, setSaving] = useState(false);
  const [createModal,   setCreateModal]   = useState(false);
  const [editPermModal, setEditPermModal] = useState(null);
  const [cForm, setCForm] = useState({ name: '', description: '' });

  const load = useCallback(() =>
    api.get('/users/roles').then(r => setRoles(r.data || [])).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/users/roles', cForm); setCreateModal(false); setCForm({ name:'', description:'' }); load(); onReload(); }
    finally { setSaving(false); }
  };

  const handleDelete = async (role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try { await api.delete(`/users/roles/${role.id}`); load(); onReload(); }
    catch (e) { alert(e.response?.data?.message || 'Cannot delete role'); }
  };

  const openEditPerms = async (role) => {
    const r = await api.get(`/users/roles/${role.id}/permissions`);
    setEditPermModal({ role, selectedIds: r.data.permissions.map(p => p.id) });
  };

  const handleSavePerms = async () => {
    setSaving(true);
    try {
      await api.put(`/users/roles/${editPermModal.role.id}/permissions`, { permission_ids: editPermModal.selectedIds });
      setEditPermModal(null); load();
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700
                     text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98]">
          + New Role
        </button>
      </div>

      <Table
        cols={['Role', 'Description', 'Permissions', 'Users', 'Type', 'Actions']}
        rows={roles.map(r => [
          <RoleBadge role={r.name} />,
          <span className="text-slate-500 dark:text-slate-400 text-xs">{r.description || '—'}</span>,
          <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{r.permission_count}</span>,
          <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{r.user_count}</span>,
          r.is_system
            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">System</span>
            : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">Custom</span>,
          <div className="flex items-center gap-1.5">
            <button onClick={() => openEditPerms(r)}
              className="px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 rounded-lg transition-all">
              Permissions
            </button>
            {!r.is_system && (
              <button onClick={() => handleDelete(r)}
                className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition-all">
                Delete
              </button>
            )}
          </div>,
        ])}
        empty="No roles"
      />

      {createModal && (
        <Modal title="New Role" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreate}>
            <Field label="Role Name *">
              <input className={inputCls} value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Supervisor" />
            </Field>
            <Field label="Description">
              <input className={inputCls} value={cForm.description} onChange={e => setCForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </Field>
            <FormActions onCancel={() => setCreateModal(false)} submitLabel="Create Role" loading={saving} />
          </form>
        </Modal>
      )}

      {editPermModal && (
        <Modal title={`Permissions — ${editPermModal.role.name}`} onClose={() => setEditPermModal(null)}>
          <PermGrid
            allPerms={allPerms}
            selected={editPermModal.selectedIds}
            onChange={ids => setEditPermModal(m => ({ ...m, selectedIds: ids }))}
          />
          <div className="flex justify-end gap-2.5 pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/50">
            <button onClick={() => setEditPermModal(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 rounded-xl transition-all">
              Cancel
            </button>
            <button onClick={handleSavePerms} disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:opacity-60 rounded-xl shadow-sm transition-all">
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Permissions Tab ─────────────────────────────────────────

function PermissionsTab({ allPerms }) {
  const byModule = {};
  for (const p of allPerms) {
    if (!byModule[p.module]) byModule[p.module] = {};
    byModule[p.module][p.action] = p;
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(ACTION_META).map(([action, { label, color }]) => (
          <span key={action} className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${color}`}>{label}</span>
        ))}
      </div>

      {/* Module cards */}
      {MODULE_ORDER.filter(m => byModule[m]).map(module => (
        <div key={module} className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/50">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              {MODULE_LABELS[module] ?? module}
            </p>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {Object.keys(byModule[module]).length} permissions
            </span>
          </div>
          {/* Pairs grid */}
          <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ACTION_PAIRS.map(([base, all]) => {
              const bPerm = byModule[module][base];
              const aPerm = byModule[module][all];
              return (
                <div key={base} className="space-y-1.5">
                  {bPerm && (
                    <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${ACTION_META[base].color}`}>
                      <p className="font-semibold">{ACTION_META[base].label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{bPerm.label?.split('—')[1]?.trim()}</p>
                    </div>
                  )}
                  {aPerm && (
                    <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${ACTION_META[all].color}`}>
                      <p className="font-semibold">{ACTION_META[all].label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{aPerm.label?.split('—')[1]?.trim()}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Root Page ───────────────────────────────────────────────

export default function Users() {
  const [tab,      setTab]      = useState('Users');
  const [allPerms, setAllPerms] = useState([]);
  const [roles,    setRoles]    = useState([]);
  const [loadKey,  setLoadKey]  = useState(0);

  const reload = () => setLoadKey(k => k + 1);

  useEffect(() => {
    api.get('/users/permissions').then(r => setAllPerms(r.data || [])).catch(() => {});
    api.get('/users/roles').then(r => setRoles(r.data || [])).catch(() => {});
  }, [loadKey]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Users & Access</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Manage user accounts, roles, and module permissions
        </p>
      </div>

      <Tabs tabs={['Users', 'Roles', 'Permissions']} active={tab} onChange={setTab} />

      {tab === 'Users'       && <UsersTab       key={`u-${loadKey}`} allPerms={allPerms} roles={roles} />}
      {tab === 'Roles'       && <RolesTab       key={`r-${loadKey}`} allPerms={allPerms} onReload={reload} />}
      {tab === 'Permissions' && <PermissionsTab allPerms={allPerms} />}
    </div>
  );
}
