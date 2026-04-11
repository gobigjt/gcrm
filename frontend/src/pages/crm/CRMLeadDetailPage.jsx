import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { inputCls, selectCls } from '../../components/FormField';
import { useToast, ToastContainer } from '../../components/Toast';

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function CRMLeadDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toasts, show: showToast } = useToast();
  const [lead, setLead] = useState(null);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [actForm, setActForm] = useState({ type: 'note', description: '' });
  const [fuForm, setFuForm] = useState({ due_date: '', description: '', assigned_to: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/crm/leads/${id}`).then((r) => setLead(r.data.lead || r.data)).catch(() => setLead(null));
    api.get('/crm/leads/stages').then((r) => setStages(r.data || [])).catch(() => setStages([]));
    api.get('/crm/leads/assignees').then((r) => setUsers(r.data || [])).catch(() => setUsers([]));
    api.get(`/crm/leads/${id}/activities`).then((r) => setActivities(r.data || [])).catch(() => setActivities([]));
    api.get(`/crm/leads/${id}/followups`).then((r) => setFollowups(r.data || [])).catch(() => setFollowups([]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const whatsappUrl = useMemo(() => {
    if (!lead?.phone) return null;
    return `https://wa.me/${lead.phone.replace(/\D/g, '')}`;
  }, [lead?.phone]);

  const changeStage = async (stage_id) => {
    await api.patch(`/crm/leads/${id}`, { stage_id });
    load();
  };

  const logActivity = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/crm/leads/${id}/activities`, actForm);
      setActForm({ type: 'note', description: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const addFollowup = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/crm/leads/${id}/followups`, fuForm);
      setFuForm({ due_date: '', description: '', assigned_to: '' });
      load();
      showToast('Task created successfully');
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (fid) => {
    await api.patch(`/crm/leads/${id}/followups/${fid}/done`);
    load();
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this lead?')) return;
    await api.delete(`/crm/leads/${id}`);
    nav('/crm');
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <ToastContainer toasts={toasts} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">{leadDisplayTitle(lead) || 'Lead'}</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">View lead details, timeline and follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/crm/leads/${id}/edit`} className="btn-wf-primary">Edit Lead</Link>
          <button type="button" onClick={onDelete} className="btn-wf-danger">Delete</button>
          <Link to="/crm" className="btn-wf-secondary">Back</Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Phone',      lead?.phone            || '—'],
            ['Email',      lead?.email            || '—'],
            ['Company',    lead?.company          || '—'],
            ['Source',     lead?.source           || '—'],
            ['Segment',    lead?.lead_segment     || '—'],
            ['Job Title',  lead?.job_title        || '—'],
            ['Website',    lead?.website          || '—'],
            ['Address',    lead?.address          || '—'],
            ['Priority',   lead?.priority         || '—'],
            ['Deal Size',  lead?.deal_size != null ? `Rs ${Number(lead.deal_size).toLocaleString('en-IN')}` : '—'],
            ['Lead Score', lead?.lead_score != null ? String(lead.lead_score) : '—'],
            ['Created',    formatDate(lead?.created_at)],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 break-all">{v}</p>
            </div>
          ))}
        </div>

        {Array.isArray(lead?.tags) && lead.tags.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((t, i) => (
                <span key={`${t}-${i}`} className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{t}</span>
              ))}
            </div>
          </div>
        )}

        {lead?.notes && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
            <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Assigned To',      lead?.assigned_name         || 'Unassigned'],
            ['Assigned Manager', lead?.assigned_manager_name || 'Unassigned'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{v}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Move Stage</p>
          <div className="flex flex-wrap gap-2">
            {stages.map((s) => (
              <button key={s.id} type="button" onClick={() => changeStage(s.id)} className="px-3 py-1 rounded-full text-xs border border-slate-300 dark:border-slate-600 hover:border-brand-500">
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-green-600 hover:text-green-700">Open WhatsApp</a>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-5">
          <h3 className="text-sm font-semibold mb-3">Activity timeline</h3>
          <form onSubmit={logActivity} className="space-y-2 mb-3">
            <select className={selectCls} value={actForm.type} onChange={(e) => setActForm((f) => ({ ...f, type: e.target.value }))}>
              {['note', 'call', 'email', 'meeting', 'whatsapp', 'sms'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea className={inputCls + ' h-16 resize-none'} value={actForm.description} onChange={(e) => setActForm((f) => ({ ...f, description: e.target.value }))} required />
            <button className="btn-wf-primary" disabled={saving}>{saving ? 'Saving…' : 'Log Activity'}</button>
          </form>
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="text-sm border rounded-lg border-slate-200 dark:border-slate-700 p-2">
                <div>{a.description}</div>
                <div className="text-xs text-slate-500">{a.type} · {formatDate(a.created_at)}</div>
              </div>
            ))}
            {activities.length === 0 && <p className="text-sm text-slate-500">No activities yet</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-5">
          <h3 className="text-sm font-semibold mb-3">Follow-ups</h3>
          <form onSubmit={addFollowup} className="space-y-2 mb-3">
            <input type="datetime-local" className={inputCls} value={fuForm.due_date} onChange={(e) => setFuForm((f) => ({ ...f, due_date: e.target.value }))} required />
            <input className={inputCls} value={fuForm.description} onChange={(e) => setFuForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" />
            <select className={selectCls} value={fuForm.assigned_to} onChange={(e) => setFuForm((f) => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Assign to me</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn-wf-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Follow-up'}</button>
          </form>
          <div className="space-y-2">
            {followups.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-sm border rounded-lg border-slate-200 dark:border-slate-700 p-2">
                <div>
                  <div>{f.description || 'Follow up'}</div>
                  <div className="text-xs text-slate-500">{formatDate(f.due_date)}</div>
                </div>
                {!f.is_done && <button className="btn-wf-secondary" type="button" onClick={() => markDone(f.id)}>Mark done</button>}
              </div>
            ))}
            {followups.length === 0 && <p className="text-sm text-slate-500">No follow-ups</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

