import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { buildAppCrmLeadUrl, buildWebCrmLeadUrl } from '../../utils/crmLeadLinks';
import { salesFromLeadPath } from '../../utils/salesFromLeadUrl';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';
import { useToast, ToastContainer } from '../../components/Toast';

// ─── Helpers ─────────────────────────────────────────────────

const PRIORITY_CFG = {
  hot:  { label: 'Hot',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',    dot: 'bg-red-500' },
  warm: { label: 'Warm', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  cold: { label: 'Cold', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',  dot: 'bg-blue-400' },
};

const STAGE_COLORS = {
  New:            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Contacted:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Qualified:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Proposal Sent':'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Negotiation:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Won:            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Lost:           'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const PriorityBadge = ({ p }) => {
  const cfg = PRIORITY_CFG[p] || PRIORITY_CFG.warm;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const StageBadge = ({ s }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[s] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{s || '—'}</span>
);

const StatCard = ({ label, value, sub, color, wireHint }) => (
  <div className="bg-[#fafaf8] dark:bg-[#1a1d2e] rounded-xl border border-[#e8e6e0] dark:border-slate-700/50 shadow-sm px-4 py-3 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <span className="text-lg">{sub}</span>
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5">{value}</p>
      {wireHint && (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">{wireHint}</p>
      )}
    </div>
  </div>
);

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dt) {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatInrAmount(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (Number.isNaN(v)) return '—';
  return `Rs ${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function scoreFmt(s) {
  const n = Number(s);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(1);
}

function potentialLabel(p) {
  if (p === 'hot') return 'HIGH';
  if (p === 'cold') return 'LOW';
  return 'MED';
}

/** Admin, Sales Manager, and Super Admin may create, edit, or delete CRM follow-up tasks. */
function canManageCrmFollowupTasks(role) {
  const r = String(role || '');
  return r === 'Admin' || r === 'Sales Manager' || r === 'Super Admin';
}

/** ISO / Postgres timestamp → value for `<input type="datetime-local" />`. */
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value (wall time in browser TZ) → UTC ISO for Postgres `TIMESTAMPTZ`. */
function datetimeLocalInputToApiIso(localValue) {
  if (!localValue || !String(localValue).trim()) return localValue;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return localValue;
  return d.toISOString();
}

function leadDisplayTitle(l) {
  if (!l) return '';
  const name = (l.name || '').trim();
  if (name) return name;
  const phone = (l.phone || '').trim();
  if (phone) return phone;
  const co = (l.company || '').trim();
  if (co) return co;
  return l.id ? `Lead #${l.id}` : '';
}

function tagsToString(tags) {
  if (!tags) return '';
  if (Array.isArray(tags)) return tags.filter(Boolean).join(', ');
  return String(tags);
}

function leadCustomFieldsMap(lead) {
  const raw = lead?.custom_fields;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function leadValue(lead, keys) {
  for (const key of keys) {
    const direct = lead?.[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    const custom = leadCustomFieldsMap(lead)?.[key];
    if (custom != null && String(custom).trim() !== '') return String(custom).trim();
  }
  return '';
}

function leadPlatformLabel(lead) {
  const raw = leadValue(lead, ['platform', 'import_source', 'sheet_source_raw']) || lead?.source || '';
  const norm = raw.toLowerCase();
  if (norm === 'google_sheet') return 'Google Sheet';
  if (norm === 'facebook') return 'Facebook';
  return raw || '—';
}

// ─── Lead Form Modal ─────────────────────────────────────────

const EMPTY = {
  name: '', email: '', phone: '', company: '', source_id: '', stage_id: '', assigned_to: '', assigned_manager_id: '', priority: 'warm', notes: '',
  lead_segment: '', job_title: '', website: '', address: '', tags: '', deal_size: '', lead_score: '',
};

function leadToForm(row) {
  if (!row) return { ...EMPTY };
  return {
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    company: row.company || '',
    source_id: row.source_id ?? '',
    stage_id: row.stage_id ?? '',
    assigned_to: row.assigned_to ?? '',
    assigned_manager_id: row.assigned_manager_id ?? '',
    priority: row.priority || 'warm',
    notes: row.notes || '',
    lead_segment: row.lead_segment || '',
    job_title: row.job_title || '',
    website: row.website || '',
    address: row.address || '',
    tags: tagsToString(row.tags),
    deal_size: row.deal_size != null && row.deal_size !== '' ? String(row.deal_size) : '',
    lead_score: row.lead_score != null && row.lead_score !== '' ? String(row.lead_score) : '',
  };
}

function LeadModal({ lead, stages, sources, users, onClose, onSaved }) {
  const [form, setForm] = useState(() => leadToForm(lead));
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const assigneeLabel = (u) => (String(u?.role || '').toLowerCase() === 'manager' ? `${u.name} (Manager)` : u.name);

  const buildPayload = () => {
    const tagsArr = form.tags
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const dealRaw = form.deal_size.trim();
    const scoreRaw = form.lead_score.trim();
    return {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      source_id: form.source_id ? Number(form.source_id) : null,
      stage_id: form.stage_id ? Number(form.stage_id) : null,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      assigned_manager_id: form.assigned_manager_id ? Number(form.assigned_manager_id) : null,
      priority: form.priority,
      notes: form.notes.trim() || null,
      lead_segment: form.lead_segment.trim() || null,
      job_title: form.job_title.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      tags: tagsArr,
      deal_size: dealRaw === '' ? null : Number(dealRaw),
      lead_score: scoreRaw === '' ? null : Number(scoreRaw),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = buildPayload();
      if (lead) {
        await api.patch(`/crm/leads/${lead.id}`, body);
      } else {
        await api.post('/crm/leads', body);
      }
      onSaved();
    } finally { setLoading(false); }
  };

  return (
    <Modal title={lead ? 'Edit Lead' : 'New Lead'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name *">
          <input className={inputCls} value={form.name} onChange={set('name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Company"><input className={inputCls} value={form.company} onChange={set('company')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Segment (e.g. B2C)">
            <input className={inputCls} value={form.lead_segment} onChange={set('lead_segment')} placeholder="B2C / B2B" />
          </Field>
          <Field label="Job title">
            <input className={inputCls} value={form.job_title} onChange={set('job_title')} placeholder="Role / designation" />
          </Field>
        </div>
        <Field label="Website">
          <input className={inputCls} type="url" value={form.website} onChange={set('website')} placeholder="https://…" />
        </Field>
        <Field label="Address">
          <textarea className={inputCls + ' h-16 resize-none'} value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Tags">
          <input className={inputCls} value={form.tags} onChange={set('tags')} placeholder="Comma-separated" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deal size (INR)">
            <input className={inputCls} inputMode="decimal" value={form.deal_size} onChange={set('deal_size')} placeholder="Optional" />
          </Field>
          <Field label="Lead score">
            <input className={inputCls} inputMode="decimal" value={form.lead_score} onChange={set('lead_score')} placeholder="e.g. 2.5" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <select className={selectCls} value={form.source_id} onChange={set('source_id')}>
              <option value="">Select…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Stage">
            <select className={selectCls} value={form.stage_id} onChange={set('stage_id')}>
              <option value="">Select…</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned To">
            <select className={selectCls} value={form.assigned_to} onChange={set('assigned_to')}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{assigneeLabel(u)}</option>)}
            </select>
          </Field>
          <Field label="Assign Manager">
            <select className={selectCls} value={form.assigned_manager_id} onChange={set('assigned_manager_id')}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{assigneeLabel(u)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select className={selectCls} value={form.priority} onChange={set('priority')}>
              <option value="hot">🔥 Hot</option>
              <option value="warm">☀️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputCls + ' h-20 resize-none'} value={form.notes} onChange={set('notes')} />
        </Field>
        <FormActions onCancel={onClose} submitLabel={lead ? 'Save Changes' : 'Add Lead'} loading={loading} />
      </form>
    </Modal>
  );
}

// ─── Lead Drawer ─────────────────────────────────────────────

function LeadDrawer({ lead, stages, sources, users, onClose, onUpdated, canManageTasks }) {
  const nav = useNavigate();
  const { toasts: drawerToasts, show: showToast } = useToast();
  const [activities, setActivities] = useState([]);
  const [followups,  setFollowups]  = useState([]);
  const [actForm,    setActForm]    = useState({ type: 'note', description: '' });
  const [fuForm,     setFuForm]     = useState({ due_date: '', description: '', assigned_to: '' });
  const [fuEditId,   setFuEditId]   = useState(null);
  const [fuEditForm, setFuEditForm] = useState({ due_date: '', description: '', assigned_to: '' });
  const [saving,     setSaving]     = useState(false);
  const [detail,     setDetail]     = useState(lead);
  const [copyLabel,    setCopyLabel]    = useState('');
  const [copyAppLabel, setCopyAppLabel] = useState('');

  const reload = useCallback(() => {
    api.get(`/crm/leads/${lead.id}`).then(r => setDetail(r.data.lead || r.data));
    api.get(`/crm/leads/${lead.id}/activities`).then(r => setActivities(r.data || []));
    api.get(`/crm/leads/${lead.id}/followups`).then(r => setFollowups(r.data || []));
  }, [lead.id]);

  useEffect(() => { reload(); }, [reload]);

  const changeStage = async (stage_id) => {
    await api.patch(`/crm/leads/${lead.id}`, { stage_id });
    reload(); onUpdated();
  };

  const logActivity = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/crm/leads/${lead.id}/activities`, actForm);
      setActForm({ type: 'note', description: '' });
      reload();
    } finally { setSaving(false); }
  };

  const addFollowup = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/crm/leads/${lead.id}/followups`, {
        ...fuForm,
        due_date: datetimeLocalInputToApiIso(fuForm.due_date),
      });
      setFuForm({ due_date: '', description: '', assigned_to: '' });
      reload();
      showToast('Task created successfully');
    } finally { setSaving(false); }
  };

  const markDone = async (fid) => {
    await api.patch(`/crm/leads/${lead.id}/followups/${fid}/done`);
    reload();
  };

  const openFuEdit = (f) => {
    setFuEditId(f.id);
    setFuEditForm({
      due_date: toDatetimeLocalValue(f.due_date),
      description: f.description || '',
      assigned_to: f.assigned_to != null && f.assigned_to !== '' ? String(f.assigned_to) : '',
    });
  };

  const saveFollowupEdit = async (e) => {
    e.preventDefault();
    if (fuEditId == null) return;
    setSaving(true);
    try {
      await api.patch(`/crm/leads/${lead.id}/followups/${fuEditId}`, {
        due_date: datetimeLocalInputToApiIso(fuEditForm.due_date),
        description: fuEditForm.description,
        assigned_to: fuEditForm.assigned_to === '' ? null : Number(fuEditForm.assigned_to),
      });
      setFuEditId(null);
      reload();
      showToast('Task updated');
    } finally {
      setSaving(false);
    }
  };

  const deleteFollowup = async (fid) => {
    if (!window.confirm('Delete this task?')) return;
    setSaving(true);
    try {
      await api.delete(`/crm/leads/${lead.id}/followups/${fid}`);
      if (fuEditId === fid) setFuEditId(null);
      reload();
      showToast('Task deleted');
    } finally {
      setSaving(false);
    }
  };

  const whatsappUrl = detail?.phone
    ? `https://wa.me/${detail.phone.replace(/\D/g, '')}`
    : null;

  const copyLeadLink = async () => {
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const url = buildWebCrmLeadUrl({
      origin: window.location.origin,
      basePath,
      leadId: lead.id,
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Failed');
    }
    window.setTimeout(() => setCopyLabel(''), 2000);
  };

  const copyAppLeadLink = async () => {
    const url = buildAppCrmLeadUrl(lead.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopyAppLabel('Copied');
    } catch {
      setCopyAppLabel('Failed');
    }
    window.setTimeout(() => setCopyAppLabel(''), 2000);
  };

  const canConvertToCustomer = !detail?.is_converted
    && (String(detail?.email || '').trim() || String(detail?.phone || '').trim());

  const convertToCustomer = async () => {
    if (!canConvertToCustomer) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/crm/leads/${lead.id}/convert-customer`);
      showToast(
        data?.already_existed
          ? 'Customer already linked — see Sales → Customers.'
          : 'Customer created — see Sales → Customers.',
      );
      reload();
      onUpdated();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not convert lead';
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const ACTIVITY_ICONS = {
    note: '📝', call: '📞', email: '📧', meeting: '🤝', whatsapp: '💬', sms: '💬',
  };

  const titleLine = leadDisplayTitle(detail);
  const dealStr = formatInrAmount(detail?.deal_size);
  const scoreLine = scoreFmt(detail?.lead_score ?? 0);
  const potLine = potentialLabel(detail?.priority);

  return (
    <div className="fixed inset-0 z-40 flex">
      <ToastContainer toasts={drawerToasts} />
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white dark:bg-[#13152a] shadow-2xl flex flex-col overflow-hidden border-l border-slate-200/80 dark:border-slate-700/50">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {(titleLine || '?').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{titleLine || '—'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[detail?.job_title, detail?.lead_segment].filter(Boolean).join(' · ') || detail?.company || detail?.email || '—'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none px-1">×</button>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge p={detail?.priority} />
            <StageBadge s={detail?.stage} />
            {detail?.phone && (
              <a href={`tel:${detail.phone}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                📞 {detail.phone}
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                💬 WhatsApp
              </a>
            )}
            <button type="button" onClick={copyLeadLink}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              {copyLabel || '🔗 Copy link'}
            </button>
            <button type="button" title="Opens EZCRM app when installed (ezcrm://)" onClick={copyAppLeadLink}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              {copyAppLabel || '📱 App link'}
            </button>
            {canConvertToCustomer && (
              <button
                type="button"
                disabled={saving}
                onClick={convertToCustomer}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50">
                {saving ? '…' : '👤 To customer'}
              </button>
            )}
            <button onClick={() => nav(`/crm/leads/${detail.id}/edit`)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors ml-auto">
              ✏️ Edit
            </button>
          </div>

          {/* Showcase-style quick actions */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button type="button"
              onClick={() => setActForm({ type: 'call', description: '' })}
              className="h-11 rounded-xl bg-[#185FA5] text-white text-[11px] font-semibold flex items-center justify-center gap-1 hover:opacity-95">
              📞 Log call
            </button>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800">
              💬 WA
              </a>
            ) : (
              <span className="h-11 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-slate-400 text-[10px] flex items-center justify-center">No phone</span>
            )}
            <Link
              to={salesFromLeadPath(lead.id)}
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800">
              🛒 Sales
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg bg-[#FAEEDA] dark:bg-amber-900/20 px-2 py-2 text-center">
              <p className="text-[10px] text-[#633806] dark:text-amber-300 font-medium">Potential</p>
              <p className="text-xs font-bold text-[#633806] dark:text-amber-200">{potLine}</p>
            </div>
            <div className="rounded-lg bg-[#E6F1FB] dark:bg-blue-900/20 px-2 py-2 text-center">
              <p className="text-[10px] text-[#0C447C] dark:text-blue-300 font-medium">Score</p>
              <p className="text-xs font-bold text-[#0C447C] dark:text-blue-200">{scoreLine}</p>
            </div>
            <div className="rounded-lg bg-[#E1F5EE] dark:bg-emerald-900/20 px-2 py-2 text-center">
              <p className="text-[10px] text-[#085041] dark:text-emerald-300 font-medium">Deal (INR)</p>
              <p className="text-xs font-bold text-[#085041] dark:text-emerald-200">{dealStr}</p>
            </div>
          </div>
        </div>

        {/* Single scroll: info + timeline + follow-ups (wireframe / mobile parity) */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Assigned', detail?.assigned_name         || 'Unassigned'],
                ['Manager',  detail?.assigned_manager_name || 'Unassigned'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Move Stage</p>
              <div className="flex flex-wrap gap-1.5">
                {stages.map(s => (
                  <button key={s.id} type="button" onClick={() => changeStage(s.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${detail?.stage === s.name
                      ? `${STAGE_COLORS[s.name] || 'bg-brand-100 text-brand-700'} border-current`
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Email',       detail?.email           || '—'],
                ['Phone',       detail?.phone           || '—'],
                ['Company',     detail?.company         || '—'],
                ['Source',      detail?.source          || '—'],
                ['Segment',     detail?.lead_segment    || '—'],
                ['Job Title',   detail?.job_title       || '—'],
                ['Website',     detail?.website         || '—'],
                ['Address',     detail?.address         || '—'],
                ['Priority',    detail?.priority        || '—'],
                ['Deal Size',   detail?.deal_size != null ? `Rs ${Number(detail.deal_size).toLocaleString('en-IN')}` : '—'],
                ['Lead Score',  detail?.lead_score != null ? String(detail.lead_score) : '—'],
                ['Created',     formatDate(detail?.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 break-all">{v}</p>
                </div>
              ))}
            </div>

            {Array.isArray(detail?.tags) && detail.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((t, i) => (
                    <span key={`${t}-${i}`} className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail?.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Activity timeline</p>
              <form onSubmit={logActivity} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2 mb-4">
                <div className="flex gap-2">
                  <select className={selectCls + ' flex-shrink-0 w-32'} value={actForm.type}
                    onChange={e => setActForm(f => ({ ...f, type: e.target.value }))}>
                    {['note','call','email','meeting','whatsapp','sms'].map(t => (
                      <option key={t} value={t}>{ACTIVITY_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <textarea
                    className={inputCls + ' flex-1 resize-none h-10 py-2'}
                    placeholder="Log an activity…"
                    value={actForm.description}
                    onChange={e => setActForm(f => ({ ...f, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Log'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {activities.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-2">No activities yet</p>
                )}
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <div className="w-2 flex justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[#534AB7] mt-1.5" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-xl border border-slate-100 dark:border-slate-700/50 px-3 py-2 bg-white dark:bg-slate-800/40">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.description}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {a.type} · {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Follow-ups</p>
              {!canManageTasks && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Only admins and sales managers can add, edit, or delete tasks. You can still mark tasks done when assigned to you.
                </p>
              )}
              {canManageTasks && fuEditId != null && (
                <form onSubmit={saveFollowupEdit} className="bg-amber-50/80 dark:bg-amber-900/15 rounded-xl p-3 space-y-2 mb-4 border border-amber-200/60 dark:border-amber-800/30">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Edit task</p>
                  <Field label="Due Date">
                    <input type="datetime-local" className={inputCls}
                      value={fuEditForm.due_date} onChange={e => setFuEditForm(f => ({ ...f, due_date: e.target.value }))}
                      required />
                  </Field>
                  <Field label="Description">
                    <input className={inputCls} placeholder="e.g. Follow up on proposal…"
                      value={fuEditForm.description} onChange={e => setFuEditForm(f => ({ ...f, description: e.target.value }))} />
                  </Field>
                  <Field label="Assign To">
                    <select className={selectCls} value={fuEditForm.assigned_to} onChange={e => setFuEditForm(f => ({ ...f, assigned_to: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </Field>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFuEditId(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
              {canManageTasks && (
                <form onSubmit={addFollowup} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2 mb-4">
                  <Field label="Due Date">
                    <input type="datetime-local" className={inputCls}
                      value={fuForm.due_date} onChange={e => setFuForm(f => ({ ...f, due_date: e.target.value }))}
                      required />
                  </Field>
                  <Field label="Description">
                    <input className={inputCls} placeholder="e.g. Follow up on proposal…"
                      value={fuForm.description} onChange={e => setFuForm(f => ({ ...f, description: e.target.value }))} />
                  </Field>
                  <Field label="Assign To">
                    <select className={selectCls} value={fuForm.assigned_to} onChange={e => setFuForm(f => ({ ...f, assigned_to: e.target.value }))}>
                      <option value="">Assign to me</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </Field>
                  <div className="flex justify-end">
                    <button type="submit" disabled={saving}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {saving ? 'Saving…' : 'Add Task'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {followups.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-2">No tasks scheduled</p>
                )}
                {followups.map(f => (
                  <div key={f.id} className={`flex items-start gap-3 p-3 rounded-xl border ${f.is_done
                    ? 'opacity-50 bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/30'
                    : new Date(f.due_date) < new Date()
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                      : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'}`}>
                    <button type="button" onClick={() => !f.is_done && markDone(f.id)}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${f.is_done
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-brand-500'}`}>
                      {f.is_done && <span className="text-white text-xs flex items-center justify-center leading-none">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${f.is_done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {f.description || 'Follow up'}
                      </p>
                      <p className={`text-xs mt-0.5 ${new Date(f.due_date) < new Date() && !f.is_done ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                        {formatDate(f.due_date)} {f.assigned_name ? `· ${f.assigned_name}` : ''}
                      </p>
                    </div>
                    {canManageTasks && (
                      <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                        {!f.is_done && (
                          <button type="button" onClick={() => openFuEdit(f)}
                            className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                            Edit
                          </button>
                        )}
                        <button type="button" onClick={() => deleteFollowup(f.id)}
                          className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Kanban View ─────────────────────────────────────────────

function KanbanView({ leads, stages, onSelectLead }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.stage === stage.name);
        const stageCls = STAGE_COLORS[stage.name] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
        return (
          <div key={stage.id} className="bg-slate-50 dark:bg-[#1a1d2e]/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/40 p-3 min-w-[220px] w-56 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stageCls}`}>{stage.name}</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full px-2 py-0.5 font-medium">{stageLeads.length}</span>
            </div>
            <div className="space-y-2">
              {stageLeads.map(l => (
                <div key={l.id} onClick={() => onSelectLead(l)}
                  className="bg-white dark:bg-[#13152a] rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700/50 cursor-pointer hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{leadDisplayTitle(l)}</p>
                    <div className="flex flex-col items-end gap-0.5">
                      <PriorityBadge p={l.priority} />
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{scoreFmt(l.lead_score)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{l.company || l.email || l.lead_segment || '—'}</p>
                  {l.phone && (
                    <div className="flex items-center gap-1.5">
                      <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">📞</a>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400">💬</a>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{l.phone}</span>
                    </div>
                  )}
                  {l.assigned_name && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">👤 {l.assigned_name}</p>
                  )}
                </div>
              ))}
              {stageLeads.length === 0 && (
                <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-3">Empty</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Follow-ups Global View ───────────────────────────────────

function FollowupsView({ onSelectLead }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/crm/leads/followups').then(r => setItems(r.data || [])).catch(() => {});
  }, []);

  const markDone = async (leadId, fid) => {
    await api.patch(`/crm/leads/${leadId}/followups/${fid}/done`);
    setItems(prev => prev.filter(f => f.id !== fid));
  };

  const isOverdue = (dt) => new Date(dt) < new Date();

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
          <p className="text-3xl mb-3">✅</p>
          No pending follow-ups — you're all caught up!
        </div>
      )}
      {items.map(f => (
        <div key={f.id} className={`flex items-center gap-4 p-4 rounded-2xl border bg-white dark:bg-[#1a1d2e] shadow-card transition-all
          ${isOverdue(f.due_date) ? 'border-red-200 dark:border-red-800/40' : 'border-slate-200/80 dark:border-slate-700/50'}`}>
          <button onClick={() => markDone(f.lead_id, f.id)}
            className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 flex-shrink-0 transition-colors" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-brand-600 dark:hover:text-brand-400"
                onClick={() => onSelectLead({ id: f.lead_id, name: f.lead_name })}>
                {f.lead_name}
              </span>
              {f.lead_company && <span className="text-xs text-slate-400">· {f.lead_company}</span>}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{f.description || 'Follow up'}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-semibold ${isOverdue(f.due_date) ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
              {isOverdue(f.due_date) ? '⚠ ' : ''}{formatDate(f.due_date)}
            </p>
            {f.assigned_name && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{f.assigned_name}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────

const CRM_TAB_BY_PARAM = {
  list: 'List',
  leads: 'List',
  contacts: 'List',
  pipeline: 'Kanban',
  kanban: 'Kanban',
  followups: 'Follow-ups',
  'follow-ups': 'Follow-ups',
};

function stageCount(stats, name) {
  return stats?.by_stage?.find((s) => s.name === name)?.count ?? 0;
}

function stageCountLike(stats, substr) {
  const row = stats?.by_stage?.find((s) => (s.name || '').toLowerCase().includes(substr.toLowerCase()));
  return row?.count ?? 0;
}

export default function CRM() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openedLeadFromUrl = useRef(null);
  const [leads,    setLeads]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [stages,   setStages]   = useState([]);
  const [sources,  setSources]  = useState([]);
  const [segments, setSegments] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [tab,      setTab]      = useState('List');
  const [drawer,   setDrawer]   = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [dashEx, setDashEx] = useState(null);

  // Filters
  const [search,   setSearch]   = useState('');
  const [fStage,   setFStage]   = useState('');
  const [fSource,  setFSource]  = useState('');
  const [fSegment, setFSegment] = useState('');
  const [fPrio,    setFPrio]    = useState('');
  const [fUser,    setFUser]    = useState('');
  const [fCreatedFrom, setFCreatedFrom] = useState('');
  const [fCreatedTo, setFCreatedTo] = useState('');
  const [sourceCounts, setSourceCounts] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [rowMenu, setRowMenu] = useState(null); // { id, top, right, lead }
  const rowMenuRef = useRef(null);

  const roleName = String(user?.role || '').toLowerCase();
  const ownAssignedOnly = roleName === 'sales executive' || roleName === 'sales manager';

  const loadLeads = useCallback(() => {
    const params = {};
    const uid = Number(user?.id);
    const effectiveAssignedTo =
      ownAssignedOnly && Number.isInteger(uid) && uid > 0 ? String(uid) : fUser;
    if (search)  params.search      = search;
    if (fStage)  params.stage_id    = fStage;
    if (fSource)  params.source_id    = fSource;
    if (fSegment) params.lead_segment = fSegment;
    if (fPrio)    params.priority     = fPrio;
    if (effectiveAssignedTo) params.assigned_to = effectiveAssignedTo;
    if (fCreatedFrom) params.created_from = fCreatedFrom;
    if (fCreatedTo) params.created_to = fCreatedTo;

    const paginatedList = tab === 'List';
    if (paginatedList) {
      params.page = listPage;
      params.page_size = listPageSize;
    }

    setLeadsLoading(true);
    api
      .get('/crm/leads', { params })
      .then((r) => {
        const d = r.data;
        if (paginatedList && d && typeof d === 'object' && !Array.isArray(d) && Array.isArray(d.data)) {
          setLeads(d.data);
          setListTotal(Number(d.total) || 0);
        } else {
          const arr = Array.isArray(d) ? d : [];
          setLeads(arr);
          if (!paginatedList) {
            setListTotal(arr.length);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLeadsLoading(false));
  }, [search, fStage, fSource, fSegment, fPrio, fUser, fCreatedFrom, fCreatedTo, ownAssignedOnly, user?.id, tab, listPage, listPageSize]);

  const loadStats = useCallback(() => {
    api.get('/crm/leads/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/crm/leads/stages').then(r => setStages(r.data || []));
    api.get('/crm/leads/sources').then(r => setSources(r.data || []));
    api.get('/crm/leads/assignees').then(r => setUsers(r.data || []));
    api.get('/crm/leads/source-counts').then((r) => setSourceCounts(r.data || null)).catch(() => setSourceCounts(null));
    api.get('/crm/leads/masters/segments').then(r => setSegments(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/crm/leads/masters/priorities').then(r => setPriorities(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/settings/dashboard').then((r) => setDashEx(r.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!rowMenu) return;
    const handler = (e) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) {
        setRowMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rowMenu]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = CRM_TAB_BY_PARAM[raw];
    const id = requestAnimationFrame(() => {
      if (mapped) setTab(mapped);
      else if (!searchParams.get('tab')) setTab('List');
    });
    return () => cancelAnimationFrame(id);
  }, [searchParams]);

  useEffect(() => {
    if (tab === 'Follow-ups') return;
    loadLeads();
  }, [loadLeads, tab]);

  /** Open drawer from `/crm?lead=123` or `?openLead=123` (email / push deep link). */
  useEffect(() => {
    const raw = searchParams.get('lead') || searchParams.get('openLead');
    if (!raw || !/^\d+$/.test(raw)) {
      openedLeadFromUrl.current = null;
      return;
    }
    if (openedLeadFromUrl.current === raw) return;
    openedLeadFromUrl.current = raw;
    api
      .get(`/crm/leads/${raw}`)
      .then((r) => {
        const row = r.data?.lead || r.data;
        if (row?.id) setDrawer(row);
      })
      .catch(() => {});
  }, [searchParams]);

  const handleCloseDrawer = useCallback(() => {
    setDrawer(null);
    const sp = new URLSearchParams(searchParams);
    let changed = false;
    if (sp.has('lead')) {
      sp.delete('lead');
      changed = true;
    }
    if (sp.has('openLead')) {
      sp.delete('openLead');
      changed = true;
    }
    if (changed) setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this lead?')) return;
    await api.delete(`/crm/leads/${id}`);
    loadStats();
    loadLeads();
  };

  const openDrawer = (lead) => {
    if (!lead?.id) return;
    setDrawer(lead);
    const sp = new URLSearchParams(searchParams);
    sp.set('lead', String(lead.id));
    sp.delete('openLead');
    setSearchParams(sp);
  };

  return (
    <div>
      {/* Header — EZcrm_web_1-style */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Home / CRM / Leads</p>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
            My leads{' '}
            <span className="tabular-nums">
              {(tab === 'List' ? listTotal : leads.length).toLocaleString('en-IN')}
            </span>
            {tab === 'List' && listTotal > listPageSize ? (
              <span className="font-normal text-slate-500 dark:text-slate-400"> · page {listPage}</span>
            ) : null}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Search and filter your pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to="/crm/masters" className="btn-wf-secondary">Masters</Link>
          <button
            type="button"
            onClick={() => navigate('/crm/leads/new')}
            className="btn-wf-primary"
          >
            + New Lead
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard
            label="Total Leads"
            value={stats.total}
            sub="◎"
            color="bg-brand-50 dark:bg-brand-900/20 text-brand-500 dark:text-brand-400"
            wireHint={[
              dashEx?.open_leads_new_7d ? `${dashEx.open_leads_new_7d} new opens (7d)` : null,
              dashEx?.overdue_invoices ? `${dashEx.overdue_invoices} overdue invoices` : null,
            ].filter(Boolean).join(' · ') || undefined}
          />
          <StatCard label="Hot Leads" value={stats.hot} sub="🔥" color="bg-red-50 dark:bg-red-900/20 text-red-500" />
          <StatCard
            label="Won"
            value={stats.by_stage?.find((s) => s.name === 'Won')?.count || 0}
            sub="✅"
            color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
          />
          <StatCard
            label="Conversion"
            value={`${stats.conversion}%`}
            sub="📈"
            color="bg-violet-50 dark:bg-violet-900/20 text-violet-500"
          />
        </div>
      )}

      <Tabs
        tabs={['List', 'Pipeline', 'Follow-ups']}
        active={tab === 'Kanban' ? 'Pipeline' : tab}
        onChange={(v) => setTab(v === 'Pipeline' ? 'Kanban' : v)}
      />


      {/* Stage chips (showcase / mobile parity) */}
      {tab !== 'Follow-ups' && stats && (() => {
        const newSt = stages.find((s) => s.name === 'New');
        const propSt = stages.find((s) => (s.name || '').toLowerCase().includes('proposal'));
        const wonSt = stages.find((s) => s.name === 'Won');
        const chipList = [
          { key: 'all', stageId: '', label: `All (${stats.total})` },
          ...(newSt ? [{ key: 'new', stageId: String(newSt.id), label: `New (${stageCount(stats, 'New')})` }] : []),
          ...(propSt ? [{ key: 'prop', stageId: String(propSt.id), label: `Proposal (${stageCountLike(stats, 'proposal')})` }] : []),
          ...(wonSt ? [{ key: 'won', stageId: String(wonSt.id), label: `Won (${stageCount(stats, 'Won')})` }] : []),
        ];
        return (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
            {chipList.map((c) => {
              const selected = (fStage || '') === c.stageId;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setFStage(c.stageId); setListPage(1); }}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold border transition-colors ${
                    selected
                      ? 'bg-[#E6F1FB] border-[#185FA5] text-[#0C447C]'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Filters */}
      {tab !== 'Follow-ups' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            placeholder="Search name, phone, company…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setListPage(1); }}
            className={inputCls + ' flex-1 max-w-xs sm:max-w-sm md:max-w-md'}
          />
          <select
            className={selectCls+'flex-1 max-w-40'}
            value={fStage}
            onChange={(e) => { setFStage(e.target.value); setListPage(1); }}
          >
            <option value="">All Stages</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className={selectCls+'flex-1 max-w-40'}
            value={fSource}
            onChange={(e) => { setFSource(e.target.value); setListPage(1); }}
          >
            <option value="">All Sources</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {segments.length > 0 && (
            <select
              className={selectCls+'flex-1 max-w-40'}
              value={fSegment}
              onChange={(e) => { setFSegment(e.target.value); setListPage(1); }}
            >
              <option value="">All Segments</option>
              {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          )}
          <select
            className={selectCls+'flex-1 max-w-40'}
            value={fPrio}
            onChange={(e) => { setFPrio(e.target.value); setListPage(1); }}
          >
            <option value="">All Priority</option>
            {priorities.length > 0
              ? priorities.map(p => <option key={p.id} value={p.name.toLowerCase()}>{p.name}</option>)
              : (<><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></>)
            }
          </select>
          {!ownAssignedOnly && (
            <select
              className={selectCls+'flex-1 max-w-60'}
              value={fUser}
              onChange={(e) => { setFUser(e.target.value); setListPage(1); }}
            >
              <option value="">All Reps</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50 pt-2 sm:pt-0 mt-1 sm:mt-0">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              From
              <input
                type="date"
                value={fCreatedFrom}
                max={fCreatedTo || undefined}
                onChange={(e) => { setFCreatedFrom(e.target.value); setListPage(1); }}
                className={inputCls + ' py-2 w-[10.5rem] text-xs'}
              />
            </label>
            <span className="text-slate-400 text-xs hidden sm:inline">–</span>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              To
              <input
                type="date"
                value={fCreatedTo}
                min={fCreatedFrom || undefined}
                onChange={(e) => { setFCreatedTo(e.target.value); setListPage(1); }}
                className={inputCls + ' py-2 w-[10.5rem] text-xs'}
              />
            </label>
            {(fCreatedFrom || fCreatedTo) && (
              <button
                type="button"
                className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline py-2"
                onClick={() => { setFCreatedFrom(''); setFCreatedTo(''); setListPage(1); }}
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {tab === 'List' && (
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
          {leadsLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
              <svg className="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm font-medium">Loading leads…</span>
            </div>
          ) : leads.length === 0 ? (
            <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No leads found</p>
          ) : (
            <table className="w-full text-sm min-w-[1320px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  {['Name / Email', 'Date', 'Phone', 'Company', 'City / State', 'Segment', 'Source', 'Stage', 'Score', 'Priority', 'Assigned', 'Actions'].map(h => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap ${
                        h === 'Actions' ? 'sticky right-0 bg-white dark:bg-[#1a1d2e] z-10' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {leads.map(l => (
                  <tr key={l.id} onClick={() => openDrawer(l)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{leadDisplayTitle(l)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{l.email || '—'}</p>
                        {l.job_title && <p className="text-xs text-slate-400 dark:text-slate-500">{l.job_title}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {l.phone ? (
                        <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}
                          className="hover:text-brand-600 dark:hover:text-brand-400">{l.phone}</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.company || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {[leadValue(l, ['city']), leadValue(l, ['state'])].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{l.lead_segment || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{l.source || '—'}</td>
                    <td className="px-4 py-3"><StageBadge s={l.stage} /></td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{scoreFmt(l.lead_score)}</td>
                    <td className="px-4 py-3"><PriorityBadge p={l.priority} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{l.assigned_name || '—'}</td>
                    <td
                      className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-[#1a1d2e]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {l.phone && (
                          <a
                            href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-base"
                          >
                            💬
                          </a>
                        )}
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (rowMenu?.id === l.id) { setRowMenu(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenu({ id: l.id, lead: l, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          }}
                        >
                          <span className="text-lg font-bold leading-none">⋮</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'List' && listTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/30">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {Math.min((listPage - 1) * listPageSize + 1, listTotal)}
                </span>
                –
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {Math.min(listPage * listPageSize, listTotal)}
                </span>
                {' '}of <span className="tabular-nums">{listTotal.toLocaleString('en-IN')}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>Per page</span>
                  <select
                    className={selectCls + ' py-1.5 text-xs min-w-[4.5rem]'}
                    value={listPageSize}
                    onChange={(e) => {
                      setListPageSize(Number(e.target.value));
                      setListPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={listPage <= 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600
                      text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-2 tabular-nums">
                    {listPage} / {Math.max(1, Math.ceil(listTotal / listPageSize))}
                  </span>
                  <button
                    type="button"
                    disabled={listPage * listPageSize >= listTotal}
                    onClick={() => setListPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600
                      text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanban */}
      {tab === 'Kanban' && (
        <KanbanView leads={leads} stages={stages} onSelectLead={openDrawer} />
      )}

      {/* Follow-ups */}
      {tab === 'Follow-ups' && (
        <FollowupsView onSelectLead={openDrawer} />
      )}

      {/* Add Lead Modal */}
      {addModal && (
        <LeadModal
          key="crm-new-lead"
          stages={stages} sources={sources} users={users}
          onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); loadLeads(); loadStats(); }}
        />
      )}

      {/* Lead Drawer */}
      {drawer && (
        <LeadDrawer
          lead={drawer}
          stages={stages} sources={sources} users={users}
          onClose={handleCloseDrawer}
          onUpdated={() => { loadLeads(); loadStats(); }}
          canManageTasks={canManageCrmFollowupTasks(user?.role)}
        />
      )}

      {/* Row context menu — portal to escape table stacking context */}
      {rowMenu && createPortal(
        <div
          ref={rowMenuRef}
          style={{ position: 'fixed', top: rowMenu.top, right: rowMenu.right, zIndex: 9999 }}
          className="w-48 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d2e] shadow-xl"
        >
          <button
            type="button"
            className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            onClick={() => { setRowMenu(null); openDrawer(rowMenu.lead); }}
          >
            View details
          </button>
          <button
            type="button"
            className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            onClick={() => { setRowMenu(null); navigate(`/crm/leads/${rowMenu.lead.id}/edit`); }}
          >
            Edit lead
          </button>
          <Link
            to={salesFromLeadPath(rowMenu.lead.id)}
            className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            onClick={() => setRowMenu(null)}
          >
            Sales / order…
          </Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
          <button
            type="button"
            className="w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            onClick={(e) => { setRowMenu(null); handleDelete(rowMenu.lead.id, e); }}
          >
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
