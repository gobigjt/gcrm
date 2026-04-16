import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { Field, inputCls, selectCls } from '../../components/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';

const EMPTY = {
  name: '', email: '', phone: '', company: '', source_id: '', stage_id: '', assigned_to: '', assigned_manager_id: '', priority: 'warm', notes: '',
  lead_segment: '', job_title: '', product_category: '', website: '', address: '', shipping_address: '', tags: '', deal_size: '', lead_score: '',
};

function tagsToString(tags) {
  if (!tags) return '';
  if (Array.isArray(tags)) return tags.filter(Boolean).join(', ');
  return String(tags);
}

function leadToForm(row) {
  if (!row) return { ...EMPTY };
  return {
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    company: row.company || '',
    source_id: row.source_id ?? '',
    stage_id: row.stage_id ?? '',
    assigned_to: row.assigned_to != null && row.assigned_to !== '' ? String(row.assigned_to) : '',
    assigned_manager_id: row.assigned_manager_id != null && row.assigned_manager_id !== '' ? String(row.assigned_manager_id) : '',
    priority: row.priority || 'warm',
    notes: row.notes || '',
    lead_segment: row.lead_segment || '',
    job_title: row.job_title || '',
    product_category: row.product_category || '',
    website: row.website || '',
    address: row.address || row.address || '',
    shipping_address: row.shipping_address || row.address || '',
    tags: tagsToString(row.tags),
    deal_size: row.deal_size != null && row.deal_size !== '' ? String(row.deal_size) : '',
    lead_score: row.lead_score != null && row.lead_score !== '' ? String(row.lead_score) : '',
  };
}

export default function CRMLeadFormPage() {
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const nav = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [segments, setSegments] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const roleName = String(user?.role || '').toLowerCase();
  const isSalesManager = roleName === 'sales manager' || roleName === 'manager';
  const salesExecutiveUsers = useMemo(
    () =>
      users.filter((u) => {
        const r = String(u?.role || '').trim().toLowerCase();
        return (
          r === 'sales executive' ||
          r === 'sales manager' ||
          r === 'admin' ||
          r === 'agent'
        );
      }),
    [users],
  );

  useEffect(() => {
    api.get('/crm/leads/stages').then((r) => setStages(r.data || [])).catch(() => setStages([]));
    api.get('/crm/leads/sources').then((r) => setSources(r.data || [])).catch(() => setSources([]));
    api.get('/crm/leads/assignees').then((r) => setUsers(r.data || [])).catch(() => setUsers([]));
    api.get('/crm/leads/masters/segments').then((r) => setSegments(Array.isArray(r.data) ? r.data : [])).catch(() => setSegments([]));
    api.get('/crm/leads/masters/priorities').then((r) => setPriorities(Array.isArray(r.data) ? r.data : [])).catch(() => setPriorities([]));
    api.get('/inventory/categories').then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/crm/leads/${id}`).then((r) => setForm(leadToForm(r.data.lead || r.data))).catch(() => {});
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
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
      assigned_to: String(form.assigned_to ?? '').trim() === '' ? null : Number(String(form.assigned_to).trim()),
      assigned_manager_id: String(form.assigned_manager_id ?? '').trim() === '' ? null : Number(String(form.assigned_manager_id).trim()),
      priority: form.priority,
      notes: form.notes.trim() || null,
      lead_segment: form.lead_segment.trim() || null,
      job_title: form.job_title.trim() || null,
      product_category: form.product_category.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,      
      shipping_address: form.shipping_address.trim() || null,
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
      if (isEdit) {
        await api.patch(`/crm/leads/${id}`, body);
        show('Lead updated successfully', 'success');
        nav(`/crm/leads/${id}`);
      } else {
        const r = await api.post('/crm/leads', body);
        const lead = r.data?.lead || r.data;
        show('Lead created successfully', 'success');
        nav(lead?.id ? `/crm/leads/${lead.id}` : '/crm');
      }
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save lead'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">{isEdit ? 'Edit Lead' : 'Create Lead'}</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Lead details and assignment</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Basic details</h3>
            <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></Field>
            </div>
            <Field label="Company"><input className={inputCls} value={form.company} onChange={set('company')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Segment">
                  <select className={selectCls} value={form.lead_segment} onChange={set('lead_segment')}>
                    <option value="">Select…</option>
                    {segments.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </Field>
              <Field label="Job title"><input className={inputCls} value={form.job_title} onChange={set('job_title')} /></Field>
            </div>
            <Field label="Product category">
              <select className={selectCls} value={form.product_category} onChange={set('product_category')}>
                <option value="">Select…</option>
                {form.product_category && !categories.some((c) => c.name === form.product_category) && (
                  <option value={form.product_category}>{form.product_category}</option>
                )}
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Website"><input className={inputCls} value={form.website} onChange={set('website')} /></Field>
            <Field label="Billing Address"><textarea className={inputCls + ' h-16 resize-none'} value={form.address} onChange={set('address')} /></Field>
            <Field label="Shipping Address"><textarea className={inputCls + ' h-16 resize-none'} value={form.shipping_address} onChange={set('shipping_address')} /></Field>
          </section>

          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assignment</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Assign to sales Executive">
                  <select className={selectCls} value={form.assigned_to} onChange={set('assigned_to')}>
                    <option value="">Unassigned</option>
                    {salesExecutiveUsers.map((u) => <option key={u.id} value={String(u.id)}>{assigneeLabel(u)}</option>)}
                  </select>
                </Field>
                {!isSalesManager && (
                  <Field label="Assign Manager">
                    <select className={selectCls} value={form.assigned_manager_id} onChange={set('assigned_manager_id')}>
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={String(u.id)}>{assigneeLabel(u)}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            </section>

            <section className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lead qualification</h3>
              <Field label="Tags"><input className={inputCls} value={form.tags} onChange={set('tags')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deal size"><input className={inputCls} value={form.deal_size} onChange={set('deal_size')} /></Field>
                <Field label="Lead score"><input className={inputCls} value={form.lead_score} onChange={set('lead_score')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <select className={selectCls} value={form.source_id} onChange={set('source_id')}>
                    <option value="">Select…</option>
                    {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Stage">
                  <select className={selectCls} value={form.stage_id} onChange={set('stage_id')}>
                    <option value="">Select…</option>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Priority">
                <select className={selectCls} value={form.priority} onChange={set('priority')}>
                  <option value="">Select…</option>
                  {priorities.length > 0
                    ? priorities.map((p) => (
                        <option key={p.id} value={p.name.toLowerCase()}>{p.name}</option>
                      ))
                    : (
                      <>
                        <option value="hot">Hot</option>
                        <option value="warm">Warm</option>
                        <option value="cold">Cold</option>
                      </>
                    )}
                </select>
              </Field>
            </section>
          </div>

        <section className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700/50 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notes</h3>
          <Field label="Notes"><textarea className={inputCls + ' h-20 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
        </section>

        <div className="flex items-center gap-2 xl:col-span-2">
          <button type="submit" className="btn-wf-primary" disabled={loading}>{loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Lead')}</button>
          <Link to={isEdit ? `/crm/leads/${id}` : '/crm'} className="btn-wf-secondary">Cancel</Link>
        </div>
        </div>
      </form>
    </div>
  );
}

