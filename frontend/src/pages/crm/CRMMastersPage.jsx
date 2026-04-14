import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Tabs from '../../components/Tabs';
import { inputCls } from '../../components/FormField';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';

const TABS = ['Sources', 'Stages', 'Segments', 'Priority'];

const API = {
  Sources:  '/crm/leads/masters/sources',
  Stages: '/crm/leads/masters/stages',
  Segments: '/crm/leads/masters/segments',
  Priority: '/crm/leads/masters/priorities',
};

const COLOR_OPTIONS = [
  { value: 'red',    label: '🔴 Red' },
  { value: 'amber',  label: '🟡 Amber' },
  { value: 'blue',   label: '🔵 Blue' },
  { value: 'green',  label: '🟢 Green' },
  { value: 'violet', label: '🟣 Violet' },
  { value: 'slate',  label: '⚫ Slate' },
];

const EMPTY_FORM = { name: '', color: '' };

function MasterTab({ tabKey }) {
  const hasPriority = tabKey === 'Priority';
  const { show: showToast } = useToast();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(API[tabKey])
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tabKey]);

  useEffect(() => { load(); setForm(EMPTY_FORM); setEditId(null); }, [load]);

  const startEdit = (item) => {
    setEditId(item.id);
    setForm({ name: item.name, color: item.color || '' });
  };

  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), ...(hasPriority ? { color: form.color } : {}) };
      if (editId) {
        await api.patch(`${API[tabKey]}/${editId}`, payload);
        showToast(`${tabKey.slice(0, -1)} updated`);
      } else {
        await api.post(API[tabKey], payload);
        showToast(`${tabKey.slice(0, -1)} added`);
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      load();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Something went wrong'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (delId) => {
    promptDestructive(showToast, {
      message: 'Delete this item?',
      onConfirm: async () => {
        setDeleting(delId);
        try {
          await api.delete(`${API[tabKey]}/${delId}`);
          showToast('Deleted');
          load();
        } catch (err) {
          showToast(apiErrorMessage(err, 'Could not delete'), 'error');
        } finally {
          setDeleting(null);
        }
      },
    });
  };


  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Form */}
      <div className="xl:col-span-1">
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
            {editId ? `Edit ${tabKey.slice(0, -1)}` : `Add ${tabKey.slice(0, -1)}`}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Name *</label>
              <input
                className={inputCls}
                placeholder={`Enter ${tabKey.toLowerCase().slice(0, -1)} name`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            {hasPriority && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Color</label>
                <select
                  className={inputCls}
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                >
                  <option value="">No color</option>
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-wf-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add'}
              </button>
              {editId && (
                <button type="button" className="btn-wf-secondary" onClick={cancelEdit}>Cancel</button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="xl:col-span-2">
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <svg className="animate-spin h-4 w-4 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No {tabKey.toLowerCase()} added yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
                  {hasPriority && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Color</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{item.name}</td>
                    {hasPriority && (
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 capitalize">{item.color || '—'}</td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="text-xs font-medium text-red-500 hover:underline disabled:opacity-40"
                        >
                          {deleting === item.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CRMMastersPage() {
  const [tab, setTab] = useState('Sources');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Home / CRM / Masters</p>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100 mt-0.5">CRM Masters</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage sources, stages, segments and priorities</p>
        </div>
        <Link to="/crm" className="btn-wf-secondary">Back to CRM</Link>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <MasterTab key={tab} tabKey={tab} />
    </div>
  );
}
