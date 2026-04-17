import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import { Field, FormActions, inputCls } from '../../components/FormField';

function StatusBadge({ active }) {
  return active
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Inactive</span>;
}

function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Tenants() {
  const { user } = useAuth();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = 8;
  const initialQuery = String(searchParams.get('q') || '');
  const initialPageParsed = Number(searchParams.get('page'));
  const initialPage = Number.isInteger(initialPageParsed) && initialPageParsed > 0 ? initialPageParsed : 1;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', is_active: true });

  const isSuperAdmin = useMemo(
    () => String(user?.role || '').trim().toLowerCase() === 'super admin',
    [user?.role],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/tenants', {
        params: {
          search: query.trim() || undefined,
          page,
          limit: pageSize,
        },
      });
      const data = r.data;
      if (Array.isArray(data)) {
        // Backward compatibility fallback if API returns raw array.
        const all = data;
        const start = (page - 1) * pageSize;
        const sliced = all.slice(start, start + pageSize);
        setRows(sliced);
        setTotal(all.length);
        setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
      } else {
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
        setTotalPages(Math.max(1, Number(data?.total_pages || 1)));
      }
    } catch (err) {
      show(apiErrorMessage(err, 'Failed to load tenants'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, show]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin, load]);

  useEffect(() => {
    const qUrl = String(searchParams.get('q') || '');
    const pRaw = Number(searchParams.get('page'));
    const pUrl = Number.isInteger(pRaw) && pRaw > 0 ? pRaw : 1;
    if (qUrl !== query) setQuery(qUrl);
    if (pUrl !== page) setPage(pUrl);
  }, [searchParams, query, page]);

  useEffect(() => {
    const current = new URLSearchParams(searchParams);
    const currentQ = String(current.get('q') || '');
    const currentPageRaw = Number(current.get('page'));
    const currentPage = Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;
    if (currentQ === query && currentPage === page) return;
    if (query.trim()) current.set('q', query.trim());
    else current.delete('q');
    if (page > 1) current.set('page', String(page));
    else current.delete('page');
    setSearchParams(current, { replace: true });
  }, [query, page, searchParams, setSearchParams]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setForm({ name: '', slug: '', is_active: true });
    setModal({ mode: 'create', id: null });
  };

  const openEdit = (row) => {
    setForm({
      name: String(row?.name || ''),
      slug: String(row?.slug || ''),
      is_active: Boolean(row?.is_active),
    });
    setModal({ mode: 'edit', id: row.id });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving || !modal) return;
    setSaving(true);
    try {
      const payload = {
        name: String(form.name || '').trim(),
        slug: String(form.slug || '').trim() || undefined,
        is_active: Boolean(form.is_active),
      };
      if (!payload.name) {
        show('Tenant name is required', 'error');
        setSaving(false);
        return;
      }

      if (modal.mode === 'create') {
        await api.post('/tenants', payload);
        show('Tenant created', 'success');
      } else {
        await api.patch(`/tenants/${modal.id}`, payload);
        show('Tenant updated', 'success');
      }
      setModal(null);
      await load();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save tenant'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    const action = row?.is_active ? 'Deactivate' : 'Activate';
    const ok = await promptDestructive({
      title: `${action} tenant`,
      message: `${action} "${row?.name || 'this tenant'}"?`,
      confirmText: action,
      tone: row?.is_active ? 'danger' : 'warning',
    });
    if (!ok) return;
    try {
      await api.patch(`/tenants/${row.id}/toggle-status`);
      show(`Tenant ${row?.is_active ? 'deactivated' : 'activated'}`, 'success');
      await load();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not change tenant status'), 'error');
    }
  };

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  const tableRows = rows.map((r) => [
    (
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">/{r.slug}</p>
      </div>
    ),
    <StatusBadge active={Boolean(r.is_active)} />,
    (
      <div className="text-xs">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{Number(r.users_total || 0)} total</p>
        <p className="text-slate-500 dark:text-slate-400">{Number(r.users_active || 0)} active</p>
      </div>
    ),
    <span className="text-xs text-slate-600 dark:text-slate-300">{fmtDate(r.created_at)}</span>,
    <span className="text-xs text-slate-600 dark:text-slate-300">{fmtDate(r.updated_at)}</span>,
    (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openEdit(r)}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => toggleStatus(r)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
            r.is_active
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {r.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tenant Accounts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Super Admin controls for tenant create, update, and activation state.
            </p>
          </div>
          <button type="button" className="btn-wf-primary" onClick={openCreate}>
            + New Tenant
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing {total === 0 ? 0 : start + 1}-
            {Math.min(start + rows.length, total)} of {total}
          </div>
          <input
            className={`${inputCls} !w-full sm:!w-72`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by tenant name or slug"
          />
        </div>
        <Table
          cols={['Tenant', 'Status', 'Users', 'Created', 'Updated', 'Actions']}
          rows={tableRows}
          empty={loading ? 'Loading tenants…' : 'No tenants found'}
          relaxLastColumnWrap
        />
        {!loading && totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:pointer-events-none"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Create tenant' : 'Edit tenant'} onClose={closeModal}>
          <form className="space-y-4" onSubmit={save}>
            <Field label="Tenant Name" required>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Acme Industries"
              />
            </Field>

            <Field label="Slug (optional)">
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value.trim().toLowerCase() }))}
                placeholder="acme-industries"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
              />
              Tenant is active
            </label>

            <FormActions
              onCancel={closeModal}
              loading={saving}
              submitLabel={modal.mode === 'create' ? 'Create Tenant' : 'Save Changes'}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
