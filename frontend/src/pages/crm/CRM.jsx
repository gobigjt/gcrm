import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

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

const StatCard = ({ label, value, sub, color }) => (
  <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card px-5 py-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <span className="text-lg">{sub}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  </div>
);

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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

// ─── Lead Form Modal ─────────────────────────────────────────

const EMPTY = { name:'', email:'', phone:'', company:'', source_id:'', stage_id:'', assigned_to:'', priority:'warm', notes:'' };

function LeadModal({ lead, stages, sources, users, onClose, onSaved }) {
  const [form, setForm] = useState(lead ? {
    name: lead.name, email: lead.email || '', phone: lead.phone || '',
    company: lead.company || '', source_id: lead.source_id || '',
    stage_id: lead.stage_id || '', assigned_to: lead.assigned_to || '',
    priority: lead.priority || 'warm', notes: lead.notes || '',
  } : EMPTY);
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (lead) {
        await api.patch(`/crm/leads/${lead.id}`, form);
      } else {
        await api.post('/crm/leads', form);
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
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
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

function LeadDrawer({ lead, stages, sources, users, onClose, onUpdated }) {
  const [drawerTab, setDrawerTab]   = useState('Info');
  const [activities, setActivities] = useState([]);
  const [followups,  setFollowups]  = useState([]);
  const [actForm,    setActForm]    = useState({ type: 'note', description: '' });
  const [fuForm,     setFuForm]     = useState({ due_date: '', description: '' });
  const [saving,     setSaving]     = useState(false);
  const [detail,     setDetail]     = useState(lead);
  const [editing,    setEditing]    = useState(false);

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
      await api.post(`/crm/leads/${lead.id}/followups`, fuForm);
      setFuForm({ due_date: '', description: '' });
      reload();
    } finally { setSaving(false); }
  };

  const markDone = async (fid) => {
    await api.patch(`/crm/leads/${lead.id}/followups/${fid}/done`);
    reload();
  };

  const whatsappUrl = detail?.phone
    ? `https://wa.me/${detail.phone.replace(/\D/g, '')}`
    : null;

  const ACTIVITY_ICONS = {
    note: '📝', call: '📞', email: '📧', meeting: '🤝', whatsapp: '💬', sms: '💬',
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white dark:bg-[#13152a] shadow-2xl flex flex-col overflow-hidden border-l border-slate-200/80 dark:border-slate-700/50">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {detail?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{detail?.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{detail?.company || detail?.email || '—'}</p>
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
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors ml-auto">
              ✏️ Edit
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex gap-0">
            {['Info', 'Activities', 'Follow-ups'].map(t => (
              <button key={t} onClick={() => setDrawerTab(t)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${drawerTab === t
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Info ── */}
          {drawerTab === 'Info' && (
            <div className="p-5 space-y-4">
              {/* Stage change */}
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Move Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {stages.map(s => (
                    <button key={s.id} onClick={() => changeStage(s.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${detail?.stage === s.name
                        ? `${STAGE_COLORS[s.name] || 'bg-brand-100 text-brand-700'} border-current`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Email',    detail?.email    || '—'],
                  ['Phone',    detail?.phone    || '—'],
                  ['Company',  detail?.company  || '—'],
                  ['Source',   detail?.source   || '—'],
                  ['Assigned', detail?.assigned_name || 'Unassigned'],
                  ['Created',  formatDate(detail?.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 break-all">{v}</p>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {detail?.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Activities ── */}
          {drawerTab === 'Activities' && (
            <div className="p-5 space-y-4">
              {/* Log activity form */}
              <form onSubmit={logActivity} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2">
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

              {/* Timeline */}
              <div className="space-y-3">
                {activities.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">No activities yet</p>
                )}
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                      {ACTIVITY_ICONS[a.type] || '📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{a.user_name || 'System'}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(a.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Follow-ups ── */}
          {drawerTab === 'Follow-ups' && (
            <div className="p-5 space-y-4">
              {/* Add follow-up form */}
              <form onSubmit={addFollowup} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Add Task / Reminder</p>
                <Field label="Due Date">
                  <input type="datetime-local" className={inputCls}
                    value={fuForm.due_date} onChange={e => setFuForm(f => ({ ...f, due_date: e.target.value }))}
                    required />
                </Field>
                <Field label="Description">
                  <input className={inputCls} placeholder="e.g. Follow up on proposal…"
                    value={fuForm.description} onChange={e => setFuForm(f => ({ ...f, description: e.target.value }))} />
                </Field>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Add Task'}
                  </button>
                </div>
              </form>

              {/* List */}
              <div className="space-y-2">
                {followups.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">No tasks scheduled</p>
                )}
                {followups.map(f => (
                  <div key={f.id} className={`flex items-start gap-3 p-3 rounded-xl border ${f.is_done
                    ? 'opacity-50 bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/30'
                    : new Date(f.due_date) < new Date()
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                      : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'}`}>
                    <button onClick={() => !f.is_done && markDone(f.id)}
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal on top of drawer */}
      {editing && (
        <LeadModal
          lead={detail}
          stages={stages} sources={sources} users={users}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload(); onUpdated(); }}
        />
      )}
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
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{l.name}</p>
                    <PriorityBadge p={l.priority} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{l.company || l.email || '—'}</p>
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

export default function CRM() {
  const [leads,    setLeads]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [stages,   setStages]   = useState([]);
  const [sources,  setSources]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [tab,      setTab]      = useState('List');
  const [drawer,   setDrawer]   = useState(null);
  const [addModal, setAddModal] = useState(false);

  // Filters
  const [search,   setSearch]   = useState('');
  const [fStage,   setFStage]   = useState('');
  const [fSource,  setFSource]  = useState('');
  const [fPrio,    setFPrio]    = useState('');
  const [fUser,    setFUser]    = useState('');

  const loadLeads = useCallback(() => {
    const params = {};
    if (search)  params.search      = search;
    if (fStage)  params.stage_id    = fStage;
    if (fSource) params.source_id   = fSource;
    if (fPrio)   params.priority    = fPrio;
    if (fUser)   params.assigned_to = fUser;
    api.get('/crm/leads', { params }).then(r => setLeads(r.data || [])).catch(() => {});
  }, [search, fStage, fSource, fPrio, fUser]);

  const loadStats = useCallback(() => {
    api.get('/crm/leads/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/crm/leads/stages').then(r => setStages(r.data || []));
    api.get('/crm/leads/sources').then(r => setSources(r.data || []));
    api.get('/crm/leads/assignees').then(r => setUsers(r.data || []));
    loadStats();
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this lead?')) return;
    await api.delete(`/crm/leads/${id}`);
    setLeads(prev => prev.filter(l => l.id !== id));
    loadStats();
  };

  const openDrawer = (lead) => {
    // If we have a full lead object, use it. Otherwise fetch by id.
    setDrawer(lead);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">CRM</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Lead pipeline management</p>
        </div>
        <button onClick={() => setAddModal(true)}
          className="bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98]">
          + New Lead
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Leads"    value={stats.total}          sub="◎" color="bg-brand-50 dark:bg-brand-900/20 text-brand-500 dark:text-brand-400" />
          <StatCard label="Hot Leads"      value={stats.hot}            sub="🔥" color="bg-red-50 dark:bg-red-900/20 text-red-500" />
          <StatCard label="Won"            value={stats.by_stage?.find(s => s.name === 'Won')?.count || 0} sub="✅" color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500" />
          <StatCard label="Conversion"     value={`${stats.conversion}%`} sub="📈" color="bg-violet-50 dark:bg-violet-900/20 text-violet-500" />
        </div>
      )}

      <Tabs tabs={['List', 'Kanban', 'Follow-ups']} active={tab} onChange={setTab} />

      {/* Filters */}
      {tab !== 'Follow-ups' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            placeholder="Search name, phone, company…"
            value={search} onChange={e => setSearch(e.target.value)}
            className={inputCls + ' flex-1 min-w-40'}
          />
          <select className={selectCls} value={fStage} onChange={e => setFStage(e.target.value)}>
            <option value="">All Stages</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={selectCls} value={fSource} onChange={e => setFSource(e.target.value)}>
            <option value="">All Sources</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={selectCls} value={fPrio} onChange={e => setFPrio(e.target.value)}>
            <option value="">All Priority</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">☀️ Warm</option>
            <option value="cold">❄️ Cold</option>
          </select>
          <select className={selectCls} value={fUser} onChange={e => setFUser(e.target.value)}>
            <option value="">All Reps</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {tab === 'List' && (
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
          {leads.length === 0 ? (
            <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No leads found</p>
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  {['Name', 'Phone', 'Company', 'Source', 'Stage', 'Priority', 'Assigned', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {leads.map(l => (
                  <tr key={l.id} onClick={() => openDrawer(l)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{l.name}</p>
                        {l.email && <p className="text-xs text-slate-400 dark:text-slate-500">{l.email}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {l.phone ? (
                        <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}
                          className="hover:text-brand-600 dark:hover:text-brand-400">{l.phone}</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.company || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{l.source || '—'}</td>
                    <td className="px-4 py-3"><StageBadge s={l.stage} /></td>
                    <td className="px-4 py-3"><PriorityBadge p={l.priority} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{l.assigned_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {l.phone && (
                          <a href={`https://wa.me/${l.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-base">
                            💬
                          </a>
                        )}
                        <button onClick={e => { e.stopPropagation(); openDrawer(l); setDrawer(l); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-xs font-medium">
                          ✏️
                        </button>
                        <button onClick={e => handleDelete(l.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-medium">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          onClose={() => setDrawer(null)}
          onUpdated={() => { loadLeads(); loadStats(); }}
        />
      )}
    </div>
  );
}
