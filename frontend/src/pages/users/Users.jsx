import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';
import { resolveApiPublicUrl } from '../../utils/publicAssetUrl';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

// ─── Constants ──────────────────────────────────────────────

const MODULE_ORDER = [
  'crm', 'sales', 'purchase', 'inventory', 'production',
  'finance', 'hr', 'settings', 'users',
];
const MODULE_LABELS = {
  crm: 'CRM', sales: 'Sales', purchase: 'Purchase', inventory: 'Inventory',
  production: 'Production', finance: 'Finance', hr: 'HR & Payroll',
  settings: 'Settings', users: 'Users',
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

/** True when role string is Sales Executive (handles spacing / casing from roles API). */
function isSalesExecutiveRole(role) {
  return String(role || '').toLowerCase().replace(/[\s_-]+/g, '') === 'salesexecutive';
}

const ROLE_COLORS = {
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Sales Manager': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  'Sales Executive': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HR:            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  default:       'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function displayRoleName(role) {
  return role === 'Super Admin' ? 'Admin' : role;
}

function UserAvatar({ name, avatarUrl }) {
  const src = resolveApiPublicUrl(avatarUrl || '');
  const initial = String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-8 h-8 object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span>{initial}</span>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

const RoleBadge = ({ role }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[displayRoleName(role)] ?? ROLE_COLORS.default}`}>
    {displayRoleName(role)}
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

// ─── Zones Tab ───────────────────────────────────────────────

function ZonesTab() {
  const { user } = useAuth();
  const { show } = useToast();
  const [zones, setZones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [cForm, setCForm] = useState({ name: '', code: '' });
  const [eForm, setEForm] = useState({ name: '', code: '' });

  const load = useCallback(() =>
    api.get('/users/zones').then(r => setZones(r.data || [])).catch(() => {}), []);

  useEffect(() => {
    if (!user || !localStorage.getItem('access_token')) {
      setZones([]);
      return;
    }
    load();
  }, [load, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users/zones', { name: cForm.name, code: cForm.code || null });
      setCreateOpen(false);
      setCForm({ name: '', code: '' });
      load();
      show('Zone created successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not create zone'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/users/zones/${editZone.id}`, { name: eForm.name, code: eForm.code || null });
      setEditZone(null);
      load();
      show('Zone updated successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update zone'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (z) => {
    promptDestructive(show, {
      message: `Delete zone “${z.name}”? Users in this zone will have zone cleared.`,
      onConfirm: async () => {
        try {
          await api.delete(`/users/zones/${z.id}`);
          load();
          show('Zone deleted successfully', 'success');
        } catch (err) {
          show(apiErrorMessage(err, 'Could not delete zone'), 'error');
        }
      },
    });
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-wf-primary">
          + New Zone
        </button>
      </div>
      <Table
        cols={['Name', 'Code', 'Created', 'Actions']}
        rows={zones.map(z => [
          <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{z.name}</span>,
          <span className="text-xs font-mono text-slate-500">{z.code || '—'}</span>,
          z.created_at?.slice(0, 10) || '—',
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditZone(z);
                setEForm({ name: z.name, code: z.code || '' });
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(z)}
              className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition-all"
            >
              Delete
            </button>
          </div>,
        ])}
        empty="No zones yet"
      />

      {createOpen && (
        <Modal title="New Zone" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate}>
            <Field label="Name *">
              <input
                className={inputCls}
                value={cForm.name}
                onChange={e => setCForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="North Region"
              />
            </Field>
            <Field label="Code (optional)">
              <input
                className={inputCls}
                value={cForm.code}
                onChange={e => setCForm(f => ({ ...f, code: e.target.value }))}
                placeholder="NR"
              />
            </Field>
            <FormActions onCancel={() => setCreateOpen(false)} submitLabel="Create Zone" loading={saving} />
          </form>
        </Modal>
      )}

      {editZone && (
        <Modal title={`Edit zone — ${editZone.name}`} onClose={() => setEditZone(null)}>
          <form onSubmit={handleEdit}>
            <Field label="Name *">
              <input
                className={inputCls}
                value={eForm.name}
                onChange={e => setEForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Code (optional)">
              <input
                className={inputCls}
                value={eForm.code}
                onChange={e => setEForm(f => ({ ...f, code: e.target.value }))}
              />
            </Field>
            <FormActions onCancel={() => setEditZone(null)} submitLabel="Save Zone" loading={saving} />
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Users Tab ───────────────────────────────────────────────

function UsersTab({ allPerms, roles }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [users,  setUsers]  = useState([]);
  const [zones,  setZones]  = useState([]);
  const [saving, setSaving] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [permModal,   setPermModal]   = useState(null);
  const [salesTeam, setSalesTeam] = useState({ assigned: [], available: [] });
  const [addExecutiveId, setAddExecutiveId] = useState('');
  const [salesManagersList, setSalesManagersList] = useState([]);

  const [cForm, setCForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Sales Executive',
    zone_id: '',
    sales_manager_id: '',
  });
  const [eForm, setEForm] = useState({
    name: '',
    email: '',
    role: 'Sales Executive',
    newPassword: '',
    zone_id: '',
    sales_manager_id: '',
  });
  const selectableRoles = roles.filter((r) => String(r?.name || '').toLowerCase() !== 'super admin');

  const loadSalesManagersList = useCallback(() =>
    api.get('/users/sales-managers').then(r => setSalesManagersList(r.data || [])).catch(() => setSalesManagersList([])),
  []);

  const load = useCallback(() =>
    api.get('/users').then(r => setUsers(r.data || [])).catch(() => {}), []);

  const loadZones = useCallback(() =>
    api.get('/users/zones').then(r => setZones(r.data || [])).catch(() => {}), []);

  useEffect(() => {
    if (!user || !localStorage.getItem('access_token')) {
      setUsers([]);
      setZones([]);
      return;
    }
    load();
    loadZones();
  }, [load, loadZones, user]);

  useEffect(() => {
    if (createModal || editModal) loadSalesManagersList();
  }, [createModal, editModal, loadSalesManagersList]);

  useEffect(() => {
    if (!editModal || editModal.role !== 'Sales Manager') {
      setSalesTeam({ assigned: [], available: [] });
      setAddExecutiveId('');
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const r = await api.get(`/users/managers/${editModal.id}/sales-team`);
        if (!cancel) {
          setSalesTeam({
            assigned: r.data?.assigned || [],
            available: r.data?.available || [],
          });
        }
      } catch {
        if (!cancel) setSalesTeam({ assigned: [], available: [] });
      }
    })();
    return () => { cancel = true; };
  }, [editModal]);

  const setC = k => e => setCForm(f => ({ ...f, [k]: e.target.value }));
  const setE = k => e => setEForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: cForm.name,
      email: cForm.email,
      password: cForm.password,
      role: cForm.role,
      zone_id: cForm.zone_id === '' || cForm.zone_id == null ? null : Number(cForm.zone_id),
    };
    if (isSalesExecutiveRole(cForm.role) && cForm.sales_manager_id !== '' && cForm.sales_manager_id != null) {
      payload.sales_manager_id = Number(cForm.sales_manager_id);
    }
    try {
      await api.post('/users', payload);
      setCreateModal(false);
      setCForm({
        name: '',
        email: '',
        password: '',
        role: 'Sales Executive',
        zone_id: '',
        sales_manager_id: '',
      });
      load();
      show('User created successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not create user'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: eForm.name,
      email: eForm.email,
      role: eForm.role,
      zone_id: eForm.zone_id === '' || eForm.zone_id == null ? null : Number(eForm.zone_id),
    };
    if (eForm.newPassword) payload.password = eForm.newPassword;
    if (isSalesExecutiveRole(eForm.role)) {
      payload.sales_manager_id =
        eForm.sales_manager_id === '' || eForm.sales_manager_id == null
          ? null
          : Number(eForm.sales_manager_id);
    }
    try {
      await api.patch(`/users/${editModal.id}`, payload);
      setEditModal(null);
      load();
      show('User updated successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update user'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u) => {
    setEForm({
      name: u.name,
      email: u.email,
      role: u.role,
      newPassword: '',
      zone_id: u.zone_id ?? '',
      sales_manager_id: u.sales_manager_id ?? '',
    });
    setEditModal(u);
  };

  const refreshSalesTeam = async () => {
    if (!editModal || editModal.role !== 'Sales Manager') return;
    try {
      const r = await api.get(`/users/managers/${editModal.id}/sales-team`);
      setSalesTeam({
        assigned: r.data?.assigned || [],
        available: r.data?.available || [],
      });
    } catch {
      setSalesTeam({ assigned: [], available: [] });
    }
  };

  const handleAddExecutiveToTeam = async () => {
    if (!addExecutiveId || !editModal) return;
    setSaving(true);
    try {
      await api.patch(`/users/${addExecutiveId}`, { sales_manager_id: editModal.id });
      setAddExecutiveId('');
      await refreshSalesTeam();
      load();
      show('Executive added to team successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not add to team'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExecutiveFromTeam = async (execId) => {
    if (!editModal) return;
    setSaving(true);
    try {
      await api.patch(`/users/${execId}`, { sales_manager_id: null });
      await refreshSalesTeam();
      load();
      show('Executive removed from team successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not remove from team'), 'error');
    } finally {
      setSaving(false);
    }
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
      setPermModal(null);
      load();
      show('Permissions saved successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save permissions'), 'error');
    } finally { setSaving(false); }
  };

  const handleToggle = async (u) => {
    try {
      await api.patch(`/users/${u.id}/toggle-status`);
      load();
      show('User status updated successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update status'), 'error');
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreateModal(true)} className="btn-wf-primary">
          + New User
        </button>
      </div>

      <Table
        cols={['User', 'Role', 'Zone', 'Overrides', 'Status', 'Joined', 'Actions']}
        rows={users.map(u => [
          <div className="flex items-center gap-2.5">
            <UserAvatar name={u.name} avatarUrl={u.avatar_url} />
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{u.name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
              {u.role === 'Sales Executive' && u.sales_manager_name && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Manager: {u.sales_manager_name}
                </p>
              )}
            </div>
          </div>,
          <RoleBadge role={u.role} />,
          <span className="text-xs text-slate-600 dark:text-slate-300">{u.zone_name || '—'}</span>,
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
                <select
                  className={selectCls}
                  value={cForm.role}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCForm((f) => ({
                      ...f,
                      role: v,
                      sales_manager_id: isSalesExecutiveRole(v) ? f.sales_manager_id : '',
                    }));
                  }}
                >
                  {selectableRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Zone">
                <select className={selectCls} value={cForm.zone_id} onChange={setC('zone_id')}>
                  <option value="">— None —</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </Field>
              {isSalesExecutiveRole(cForm.role) && (
                <div className="col-span-2">
                  <Field label="Sales manager (optional)">
                    <select className={selectCls} value={cForm.sales_manager_id} onChange={setC('sales_manager_id')}>
                      <option value="">— None —</option>
                      {salesManagersList.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {salesManagersList.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        No Sales Manager users yet — create one first to assign here.
                      </p>
                    )}
                  </Field>
                </div>
              )}
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
                <select
                  className={selectCls}
                  value={eForm.role}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEForm((f) => ({
                      ...f,
                      role: v,
                      sales_manager_id: isSalesExecutiveRole(v) ? f.sales_manager_id : '',
                    }));
                  }}
                >
                  {selectableRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="New Password">
                <input className={inputCls} type="password" value={eForm.newPassword} onChange={setE('newPassword')} placeholder="Leave blank to keep" minLength={6} />
              </Field>
              <Field label="Zone">
                <select className={selectCls} value={eForm.zone_id} onChange={setE('zone_id')}>
                  <option value="">— None —</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </Field>
              {isSalesExecutiveRole(eForm.role) && (
                <div className="col-span-2">
                  <Field label="Sales manager (optional)">
                    <select className={selectCls} value={eForm.sales_manager_id} onChange={setE('sales_manager_id')}>
                      <option value="">— None —</option>
                      {salesManagersList.filter(m => m.id !== editModal.id).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {salesManagersList.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        No Sales Manager users yet — create one first to assign here.
                      </p>
                    )}
                  </Field>
                </div>
              )}
            </div>

            {eForm.role === 'Sales Manager' && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Sales executives on this team
                </p>
                {salesTeam.assigned.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No executives assigned yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {salesTeam.assigned.map(ex => (
                      <li
                        key={ex.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{ex.name}</span>
                          <span className="text-slate-400 text-xs ml-2">{ex.email}</span>
                          {ex.zone_name && (
                            <span className="text-xs text-slate-500 block mt-0.5">Zone: {ex.zone_name}</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExecutiveFromTeam(ex.id)}
                          disabled={saving}
                          className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <Field label="Add executive">
                    <select
                      className={`${selectCls} min-w-[200px]`}
                      value={addExecutiveId}
                      onChange={e => setAddExecutiveId(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {salesTeam.available.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    onClick={handleAddExecutiveToTeam}
                    disabled={saving || !addExecutiveId}
                    className="btn-wf-secondary px-3 py-2 text-sm rounded-lg disabled:opacity-50"
                  >
                    Add to team
                  </button>
                </div>
              </div>
            )}

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
              className="btn-wf-secondary px-4 py-2 text-sm rounded-xl">
              Cancel
            </button>
            <button onClick={handleSavePerms} disabled={saving}
              className="btn-wf-primary px-5 py-2 text-sm rounded-xl shadow-sm disabled:opacity-60">
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
  const { user } = useAuth();
  const { show } = useToast();
  const [roles,  setRoles]  = useState([]);
  const [saving, setSaving] = useState(false);
  const [createModal,   setCreateModal]   = useState(false);
  const [editPermModal, setEditPermModal] = useState(null);
  const [cForm, setCForm] = useState({ name: '', description: '' });

  const load = useCallback(() =>
    api.get('/users/roles').then(r => setRoles(r.data || [])).catch(() => {}), []);

  useEffect(() => {
    if (!user || !localStorage.getItem('access_token')) {
      setRoles([]);
      return;
    }
    load();
  }, [load, user]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/users/roles', cForm);
      setCreateModal(false);
      setCForm({ name:'', description:'' });
      load();
      onReload();
      show('Role created successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not create role'), 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = (role) => {
    promptDestructive(show, {
      message: `Delete role "${role.name}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/users/roles/${role.id}`);
          load();
          onReload();
          show('Role deleted successfully', 'success');
        } catch (e) {
          show(apiErrorMessage(e, 'Cannot delete role'), 'error');
        }
      },
    });
  };

  const openEditPerms = async (role) => {
    const r = await api.get(`/users/roles/${role.id}/permissions`);
    setEditPermModal({ role, selectedIds: r.data.permissions.map(p => p.id) });
  };

  const handleSavePerms = async () => {
    setSaving(true);
    try {
      await api.put(`/users/roles/${editPermModal.role.id}/permissions`, { permission_ids: editPermModal.selectedIds });
      setEditPermModal(null);
      load();
      show('Role permissions saved successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save permissions'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreateModal(true)} className="btn-wf-primary">
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
              className="btn-wf-secondary px-4 py-2 text-sm rounded-xl">
              Cancel
            </button>
            <button onClick={handleSavePerms} disabled={saving}
              className="btn-wf-primary px-5 py-2 text-sm rounded-xl shadow-sm disabled:opacity-60">
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

const USERS_TAB_BY_PARAM = {
  users: 'Users',
  zones: 'Zones',
  roles: 'Roles',
  permissions: 'Permissions',
  rbac: 'Permissions',
};

export default function Users() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab,      setTab]      = useState('Users');
  const [allPerms, setAllPerms] = useState([]);
  const [roles,    setRoles]    = useState([]);
  const [loadKey,  setLoadKey]  = useState(0);

  const reload = () => setLoadKey(k => k + 1);

  useEffect(() => {
    if (!user || !localStorage.getItem('access_token')) {
      setAllPerms([]);
      setRoles([]);
      return;
    }
    api.get('/users/permissions').then(r => setAllPerms(r.data || [])).catch(() => {});
    api.get('/users/roles').then(r => setRoles(r.data || [])).catch(() => {});
  }, [loadKey, user]);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = USERS_TAB_BY_PARAM[raw];
    if (mapped) setTab(mapped);
    else if (!searchParams.get('tab')) setTab('Users');
  }, [searchParams]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Users & Access</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Manage user accounts, roles, and module permissions
        </p>
      </div>

      <Tabs tabs={['Users', 'Zones', 'Roles', 'Permissions']} active={tab} onChange={setTab} />

      {tab === 'Users'       && <UsersTab       key={`u-${loadKey}`} allPerms={allPerms} roles={roles} />}
      {tab === 'Zones'       && <ZonesTab       key={`z-${loadKey}`} />}
      {tab === 'Roles'       && <RolesTab       key={`r-${loadKey}`} allPerms={allPerms} onReload={reload} />}
      {tab === 'Permissions' && <PermissionsTab allPerms={allPerms} />}
    </div>
  );
}
