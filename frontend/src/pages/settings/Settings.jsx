import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveApiPublicUrl } from '../../utils/publicAssetUrl';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

// ─── Constants ───────────────────────────────────────────────

const ALL_ROLES = ['Admin', 'Sales Executive', 'HR'];

const ROLE_COLORS = {
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Sales Executive': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HR:            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  default:       'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const MODULE_ICONS = {
  crm:        '◎',
  sales:      '◈',
  purchase:   '⊕',
  inventory:  '◫',
  production: '⚙',
  finance:    '◑',
  hr:         '◉',
  settings:   '◌',
  users:      '◈',
};

// ─── Company Tab ─────────────────────────────────────────────

function letterIcon(text) {
  const t = String(text || '').trim();
  return t ? t.slice(0, 1).toUpperCase() : 'C';
}

function CompanyTab({ user }) {
  const [form,  setForm]  = useState({});
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/settings/company/logo', fd);
      setForm((f) => ({ ...f, ...(r.data || {}) }));
    } catch {
      /* toast optional */
    } finally {
      setUploadingLogo(false);
    }
  };

  const clearLogo = async () => {
    setUploadingLogo(true);
    try {
      await api.patch('/settings/company', { logo_url: '' });
      setForm((f) => ({ ...f, logo_url: '' }));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFavicon(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/settings/company/favicon', fd);
      setForm((f) => ({ ...f, ...(r.data || {}) }));
    } catch {
      /* toast optional */
    } finally {
      setUploadingFavicon(false);
    }
  };

  const clearFavicon = async () => {
    setUploadingFavicon(true);
    try {
      await api.patch('/settings/company', { favicon_url: '' });
      setForm((f) => ({ ...f, favicon_url: '' }));
    } finally {
      setUploadingFavicon(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-6 w-full">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-5">Company Profile</h3>

      {saved && (
        <div className="mb-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm rounded-xl">
          Settings saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 h-full">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Company Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 h-full">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Branding</h4>
          <Field label="Company logo">
          <div className="flex flex-wrap items-start gap-4">
            {form.logo_url ? (
              <img
                src={resolveApiPublicUrl(form.logo_url)}
                alt="Company logo"
                className="max-h-20 max-w-[200px] object-contain rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-1"
              />
            ) : (
              <div className="h-20 w-[120px] rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-[11px] text-slate-400">
                No logo
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="btn-wf-secondary text-xs cursor-pointer inline-block text-center">
                {uploadingLogo ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={handleLogoUpload}
                />
              </label>
              {form.logo_url && (
                <button type="button" className="btn-wf-secondary text-xs" disabled={uploadingLogo} onClick={clearLogo}>
                  Remove logo
                </button>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[220px]">
                JPEG, PNG, WebP, GIF, or SVG. Max 2 MB. Used on Tax Invoice print/PDF.
              </p>
            </div>
          </div>
          </Field>
          <Field label="Favicon">
          <div className="flex flex-wrap items-start gap-4 mt-3">
            {form.favicon_url ? (
              <img
                src={resolveApiPublicUrl(form.favicon_url)}
                alt="Company favicon"
                className="h-10 w-10 object-contain rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-md border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-300">
                {letterIcon(form.company_name)}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="btn-wf-secondary text-xs cursor-pointer inline-block text-center">
                {uploadingFavicon ? 'Uploading…' : 'Upload favicon'}
                <input
                  type="file"
                  accept=".ico,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingFavicon}
                  onChange={handleFaviconUpload}
                />
              </label>
              {form.favicon_url && (
                <button type="button" className="btn-wf-secondary text-xs" disabled={uploadingFavicon} onClick={clearFavicon}>
                  Remove favicon
                </button>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[220px]">
                ICO/PNG/SVG/JPG/WebP, max 1 MB. Used for browser tab icon.
              </p>
            </div>
          </div>
          </Field>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 h-full">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Address & Fiscal</h4>
          <Field label="Address">
            <textarea className={inputCls} rows={3} value={form.address || ''} onChange={set('address')} />
          </Field>
          <Field label="Fiscal Year Start">
            <input className={inputCls} type="date" value={form.fiscal_year_start || ''} onChange={set('fiscal_year_start')} />
          </Field>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 h-full">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Invoice Terms</h4>
          <Field label="Invoice header (print & PDF)">
            <textarea
              className={inputCls}
              rows={3}
              value={form.invoice_tagline || ''}
              onChange={set('invoice_tagline')}
              placeholder="Optional lines above Tax Invoice (e.g. services / tagline)."
            />
          </Field>
          <Field label="Terms and conditions">
            <textarea
              className={inputCls}
              rows={2}
              value={form.payment_terms || ''}
              onChange={set('payment_terms')}
              placeholder="Shown on Tax Invoice after totals."
            />
          </Field>
        </section>

        {(user?.role === 'Admin' || user?.role === 'Super Admin') && (
          <div className="xl:col-span-2">
            <button type="submit" className="btn-wf-primary">
              Save Settings
            </button>
          </div>
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
    setSaving(mod.module + ':' + role);
    try {
      await api.patch(`/settings/modules/${mod.module}`, { allowed_roles: next });
      load();
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Enable or disable modules, and control which roles can access them.
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
              const isSaving = saving === `${mod.module}:${role}`;
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(mod, role)}
                  disabled={isSaving || !mod.is_enabled}
                  title={isOn ? 'Click to revoke access' : 'Click to grant access'}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 border
                    ${isOn
                      ? `${ROLE_COLORS[role] ?? ROLE_COLORS.default} hover:opacity-80 cursor-pointer`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-transparent hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                    } ${!mod.is_enabled ? 'pointer-events-none' : ''} ${isSaving ? 'opacity-50' : ''}`}>
                  {isOn && <span className="mr-0.5">✓</span>}
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

  const tabs = isAdmin ? ['Company', 'Modules', 'Lead Platforms', 'Audit Logs'] : ['Company'];
  const [tab, setTab] = useState('Company');

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Company settings</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Company profile, module access, and system logs
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Company'    && <CompanyTab user={user} />}
      {tab === 'Modules'    && <ModulesTab />}
      {tab === 'Lead Platforms' && <LeadPlatformsTab />}
      {tab === 'Audit Logs' && <AuditTab />}
    </div>
  );
}

// ─── Lead Platforms Tab ─────────────────────────────────────

function LeadPlatformsTab() {
  const [pages,   setPages]   = useState([]);
  const [sheets,  setSheets]  = useState([]);
  const [sources, setSources] = useState([]);

  const [form, setForm] = useState({
    page_url: '',
    page_name: '',
    page_access_token: '',
    lead_source_id: '',
  });

  const [fbConfig, setFbConfig] = useState(null);
  const [fbPagesPick, setFbPagesPick] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [fbBusy, setFbBusy] = useState(false);
  const [fbErr, setFbErr] = useState('');

  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState({ id: null, msg: '', isError: false });
  const [sheetForm, setSheetForm] = useState({ sheet_url: '', sheet_gid: '', lead_source_id: '', data_start_row: '15' });
  const [sheetSyncResult, setSheetSyncResult] = useState({ id: null, msg: '', isError: false });

  const load = useCallback(() => {
    api.get('/crm/lead-platforms/facebook/pages').then(r => setPages(r.data || [])).catch(() => {});
    api.get('/crm/lead-platforms/google-sheets').then(r => setSheets(r.data || [])).catch(() => setSheets([]));
    api.get('/crm/leads/sources').then(r => setSources(r.data || [])).catch(() => {});
    api.get('/crm/lead-platforms/facebook/oauth/config').then(r => setFbConfig(r.data || {})).catch(() => setFbConfig({}));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const masked = (t) => {
    if (!t) return '—';
    const s = String(t);
    if (s.length <= 10) return '******';
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  };

  const ensureFbReady = useCallback(async () => {
    // FB.init requires a string App ID; JSON numbers or whitespace break the SDK ("Invalid app ID").
    const raw = fbConfig?.appId;
    const appId = raw == null || raw === '' ? '' : String(raw).replace(/\s/g, '');
    const gv = fbConfig?.graphVersion || 'v20.0';
    const version = String(gv).startsWith('v') ? gv : `v${gv}`;
    if (!appId || !/^\d{8,20}$/.test(appId)) {
      throw new Error(
        fbConfig?.setupHint ||
          'Facebook App ID from the server is missing or invalid. Use the numeric App ID from Meta → App settings → Basic.',
      );
    }

    await new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Facebook Login requires a browser.'));
        return;
      }
      if (window.FB) {
        try {
          window.FB.init({ appId, cookie: true, xfbml: false, version });
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }
      window.fbAsyncInit = () => {
        try {
          window.FB.init({ appId, cookie: true, xfbml: false, version });
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script');
        s.id = 'facebook-jssdk';
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        s.onerror = () => reject(new Error('Could not load Facebook SDK'));
        document.body.appendChild(s);
      }
    });
  }, [fbConfig]);

  const errText = (e) => {
    const m = e?.response?.data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
    return e?.message || 'Request failed';
  };

  const handleFacebookLogin = async () => {
    setFbErr('');
    if (!fbConfig?.configured) {
      setFbErr('Server needs FACEBOOK_APP_ID and FACEBOOK_APP_SECRET. Add them to backend .env and restart.');
      return;
    }
    setFbBusy(true);
    try {
      await ensureFbReady();
      const userToken = await new Promise((resolve, reject) => {
        window.FB.login(
          (res) => {
            if (!res.authResponse?.accessToken) {
              reject(new Error('Facebook login was cancelled or no access was granted.'));
              return;
            }
            const gs = res.authResponse.grantedScopes;
            if (typeof gs === 'string' && gs.trim()) {
              const granted = gs.split(',').map((s) => s.trim()).filter(Boolean);
              const need = ['pages_show_list', 'pages_read_engagement', 'leads_retrieval'];
              const missing = need.filter((s) => !granted.includes(s));
              if (missing.length) {
                reject(
                  new Error(
                    `Facebook did not grant: ${missing.join(', ')}. Open the dialog again, click "Edit settings", and turn on all listed permissions for your Page.`,
                  ),
                );
                return;
              }
            }
            resolve(res.authResponse.accessToken);
          },
          {
            scope: 'pages_show_list,pages_read_engagement,leads_retrieval',
            auth_type: 'rerequest',
            return_scopes: true,
          },
        );
      });
      const { data } = await api.post('/crm/lead-platforms/facebook/oauth/list-pages', {
        user_access_token: userToken,
      });
      const list = data?.pages || [];
      setFbPagesPick(list);
      setSelectedPageId(list[0]?.id || '');
    } catch (e) {
      setFbErr(errText(e));
    } finally {
      setFbBusy(false);
    }
  };

  const connectSelectedPage = async (e) => {
    e.preventDefault();
    const p = fbPagesPick.find((x) => String(x.id) === String(selectedPageId));
    if (!p) return;
    setSaving(true);
    setFbErr('');
    try {
      await api.post('/crm/lead-platforms/facebook/pages', {
        page_id: p.id,
        page_name: p.name || null,
        page_url: `https://www.facebook.com/${p.id}`,
        page_access_token: p.access_token,
        lead_source_id: form.lead_source_id ? Number(form.lead_source_id) : null,
      });
      setFbPagesPick([]);
      setSelectedPageId('');
      load();
    } catch (e) {
      setFbErr(errText(e));
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!form.page_url.trim()) return;
    setSaving(true);
    try {
      await api.post('/crm/lead-platforms/facebook/pages', {
        page_url: form.page_url.trim(),
        page_name: form.page_name.trim() || null,
        page_access_token: form.page_access_token.trim() || null,
        lead_source_id: form.lead_source_id ? Number(form.lead_source_id) : null,
      });
      setForm({ page_url: '', page_name: '', page_access_token: '', lead_source_id: form.lead_source_id });
      load();
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async (id) => {
    if (!confirm('Disconnect this Facebook page?')) return;
    setSaving(true);
    try {
      await api.delete(`/crm/lead-platforms/facebook/pages/${id}`);
      load();
    } catch (e) {
      setFbErr(errText(e));
    } finally {
      setSaving(false);
    }
  };

  const syncLeads = async (id) => {
    if (!confirm('Sync leads from this Facebook Page now?')) return;
    setSaving(true);
    setSyncResult({ id: null, msg: '', isError: false });
    try {
      const { data } = await api.post(`/crm/lead-platforms/facebook/pages/${id}/sync-leads`);
      setSyncResult({ id, msg: `${data.importedCount} new lead(s) imported`, isError: false });
      load();
    } catch (e) {
      setSyncResult({ id, msg: errText(e), isError: true });
    } finally {
      setSaving(false);
    }
  };

  const setSheet = (k) => (e) => setSheetForm((f) => ({ ...f, [k]: e.target.value }));

  const connectGoogleSheet = async (e) => {
    e.preventDefault();
    if (!sheetForm.sheet_url.trim()) return;
    setSaving(true);
    setSheetSyncResult({ id: null, msg: '', isError: false });
    try {
      const dsr = String(sheetForm.data_start_row ?? '').trim();
      if (dsr !== '' && !Number.isFinite(Number(dsr))) {
        setSheetSyncResult({ id: null, msg: 'First data row must be a positive number or empty.', isError: true });
        return;
      }
      await api.post('/crm/lead-platforms/google-sheets', {
        sheet_url: sheetForm.sheet_url.trim(),
        sheet_gid: sheetForm.sheet_gid.trim() || null,
        lead_source_id: sheetForm.lead_source_id ? Number(sheetForm.lead_source_id) : null,
        data_start_row: dsr === '' ? null : Number(dsr),
      });
      setSheetForm((f) => ({ ...f, sheet_url: '', sheet_gid: '' }));
      load();
    } catch (e) {
      setSheetSyncResult({ id: null, msg: errText(e), isError: true });
    } finally {
      setSaving(false);
    }
  };

  const syncSheetLeads = async (id) => {
    if (!confirm('Sync leads from this Google Sheet now?')) return;
    setSaving(true);
    setSheetSyncResult({ id: null, msg: '', isError: false });
    try {
      const { data } = await api.post(
        `/crm/lead-platforms/google-sheets/${id}/sync-leads`,
        {},
        { timeout: 180_000 },
      );
      const st = data?.stats || {};
      const msg = `${data.importedCount || 0} saved (${st.createdRows ?? 0} new, ${st.updatedRows ?? 0} updated) · ${st.skippedRows || 0} skipped` +
        ((st.skippedEmptyIdentity || st.skippedDuplicates)
          ? ` (empty: ${st.skippedEmptyIdentity || 0}, duplicates: ${st.skippedDuplicates || 0})`
          : '');
      setSheetSyncResult({ id, msg, isError: false });
      load();
    } catch (e) {
      setSheetSyncResult({ id, msg: errText(e), isError: true });
    } finally {
      setSaving(false);
    }
  };

  const disconnectSheet = async (id) => {
    if (!confirm('Disconnect this Google Sheet?')) return;
    setSaving(true);
    try {
      await api.delete(`/crm/lead-platforms/google-sheets/${id}`);
      load();
    } catch (e) {
      setSheetSyncResult({ id, msg: errText(e), isError: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-6 max-w-xl">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Facebook Pages</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Use <strong>Facebook Login</strong> to grant access to Pages you manage. We exchange your session for Page tokens
          on the server and store them for Lead Ads / Lead Form sync. In the Meta app, enable <em>Facebook Login</em> and
          add this site URL under <em>Valid OAuth Redirect URIs</em> (e.g. <code className="text-[11px]">http://localhost:5173</code>).
          Under <em>Facebook Login → Settings</em>, add permissions <code className="text-[10px]">pages_show_list</code>,{' '}
          <code className="text-[10px]">pages_read_engagement</code>, and <code className="text-[10px]">leads_retrieval</code>
          (Live mode may require App Review). If sync fails with “pages_read_engagement”, disconnect the Page and connect again using{' '}
          <em>Edit settings</em> in Meta&apos;s dialog so all three are granted.
        </p>

        {fbConfig?.setupHint && (
          <div className="mb-4 px-3 py-2 rounded-xl text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            {fbConfig.setupHint}
          </div>
        )}
        {fbErr && (
          <div className="mb-4 px-3 py-2 rounded-xl text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {fbErr}
          </div>
        )}
        {fbConfig?.configured && fbConfig?.appId && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Using Meta App ID ending in <span className="font-mono">{String(fbConfig.appId).replace(/\s/g, '').slice(-4)}</span>
            {' · '}If Facebook still says invalid App ID, confirm this matches App settings → Basic and restart the API after changing <code className="text-[10px]">.env</code>.
          </p>
        )}

        <Field label="Lead Source (for new connections)">
          <select className={selectCls} value={form.lead_source_id} onChange={set('lead_source_id')}>
            <option value="">Default (Facebook Ads)</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            disabled={fbBusy || saving || !fbConfig?.configured}
            onClick={handleFacebookLogin}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
          >
            {fbBusy ? 'Connecting to Facebook…' : 'Continue with Facebook'}
          </button>

          {fbPagesPick.length > 0 && (
            <form onSubmit={connectSelectedPage} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-600">
              <Field label="Page to connect">
                <select
                  className={selectCls}
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  required
                >
                  {fbPagesPick.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                disabled={saving || !selectedPageId}
                className="w-full btn-wf-primary py-2 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Connect selected Page'}
              </button>
            </form>
          )}
        </div>

        <details className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
          <summary className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
            Advanced: connect with Page URL &amp; token manually
          </summary>
          <form onSubmit={handleConnect} className="space-y-3 mt-3">
            <Field label="Page URL *">
              <input
                className={inputCls}
                value={form.page_url}
                onChange={set('page_url')}
                placeholder="https://www.facebook.com/<page>"
              />
            </Field>
            <Field label="Page Name (optional)">
              <input className={inputCls} value={form.page_name} onChange={set('page_name')} placeholder="My Facebook Page" />
            </Field>
            <Field label="Page Access Token">
              <input
                className={inputCls}
                type="password"
                value={form.page_access_token}
                onChange={set('page_access_token')}
                placeholder="Page token only (not User token)"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Must be a <strong>Page</strong> access token for this Page. Graph API Explorer often shows a <strong>User</strong> token by default—that will fail sync with error #190. Prefer &quot;Continue with Facebook&quot; above.
              </p>
            </Field>
            <button
              type="submit"
              disabled={saving || !form.page_url.trim()}
              className="w-full py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save manual connection'}
            </button>
          </form>
        </details>
      </div>

      <Table
        cols={['Page URL', 'Page ID', 'Page Name', 'Lead Source', 'Token', 'Actions']}
        empty="No Facebook pages connected"
        rows={pages.map(p => ([
          p.page_url || '—',
          p.page_id,
          p.page_name || '—',
          p.lead_source_name || 'Default',
          masked(p.page_access_token),
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                key={`s-${p.id}`}
                onClick={() => syncLeads(p.id)}
                disabled={saving}
                className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all disabled:opacity-50
                           bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100"
              >
                Sync Leads
              </button>
              <button
                key={`d-${p.id}`}
                onClick={() => disconnect(p.id)}
                disabled={saving}
                className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all disabled:opacity-50
                           bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
              >
                Disconnect
              </button>
            </div>
            {syncResult.id === p.id && syncResult.msg && (
              <span className={`text-[10px] ${syncResult.isError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {syncResult.msg}
              </span>
            )}
          </div>,
        ]))}
      />

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-6 max-w-xl">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Google Sheets</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Default layout (first data row = <strong>15</strong>): column <strong>A</strong> lead id, <strong>J</strong> status (matches CRM stage name),{' '}
          <strong>K</strong> sales person (matches user name), <strong>L</strong> source (<code className="text-[10px]">fb</code>/<code className="text-[10px]">facebook</code> or{' '}
          <code className="text-[10px]">ig</code>/<code className="text-[10px]">instagram</code>), <strong>M</strong> contact name, <strong>N</strong> email, <strong>O</strong> phone,{' '}
          <strong>P</strong> city, <strong>Q</strong> state, <strong>R</strong> zip. Rows above that are ignored. Same lead id + sheet connection updates the CRM lead.
          {' '}If Google&apos;s CSV has no blank rows above your data, set <em>First data row</em> to <strong>1</strong>.
          {' '}Clear <em>First data row</em> for simple CSV where row 1 is headers (<strong>name</strong>, <strong>email</strong>, …).
          {' '}If sync fails with 401/403, share the sheet as <strong>Anyone with the link can view</strong> or publish CSV.
          {' '}The API server auto-syncs <strong>active</strong> connections every <strong>10 minutes</strong> (set <code className="text-[10px]">GOOGLE_SHEETS_SYNC_DISABLED=true</code> in backend <code className="text-[10px]">.env</code> to turn off).
        </p>
        {sheetSyncResult.id == null && sheetSyncResult.msg && (
          <div className={`mb-4 px-3 py-2 rounded-xl text-xs border ${
            sheetSyncResult.isError
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
          }`}>
            {sheetSyncResult.msg}
          </div>
        )}
        <form onSubmit={connectGoogleSheet} className="space-y-3">
          <Field label="Google Sheet URL *">
            <input
              className={inputCls}
              value={sheetForm.sheet_url}
              onChange={setSheet('sheet_url')}
              placeholder="https://docs.google.com/spreadsheets/d/<id>/edit#gid=0"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="GID (optional)">
              <input className={inputCls} value={sheetForm.sheet_gid} onChange={setSheet('sheet_gid')} placeholder="0" />
            </Field>
            <Field label="First data row (1-based)">
              <input
                className={inputCls}
                value={sheetForm.data_start_row}
                onChange={setSheet('data_start_row')}
                placeholder="15"
              />
            </Field>
            <Field label="Lead Source (fallback)">
              <select className={selectCls} value={sheetForm.lead_source_id} onChange={setSheet('lead_source_id')}>
                <option value="">Default (Facebook Ads)</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <button type="submit" disabled={saving || !sheetForm.sheet_url.trim()} className="w-full btn-wf-primary py-2 disabled:opacity-60">
            {saving ? 'Saving…' : 'Connect Google Sheet'}
          </button>
        </form>
      </div>

      <Table
        cols={['Sheet URL', 'GID', 'Start row', 'Lead Source', 'Status', 'Actions']}
        empty="No Google Sheets connected"
        rows={sheets.map((s) => ([
          s.sheet_url || '—',
          s.sheet_gid || '0',
          s.data_start_row != null ? String(s.data_start_row) : '1 = headers',
          s.lead_source_name || 'Default',
          s.is_active ? 'Active' : 'Inactive',
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                key={`ss-${s.id}`}
                onClick={() => syncSheetLeads(s.id)}
                disabled={saving}
                className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all disabled:opacity-50
                           bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100"
              >
                Sync Leads
              </button>
              <button
                key={`sd-${s.id}`}
                onClick={() => disconnectSheet(s.id)}
                disabled={saving}
                className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all disabled:opacity-50
                           bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
              >
                Disconnect
              </button>
            </div>
            {sheetSyncResult.id === s.id && sheetSyncResult.msg && (
              <span className={`text-[10px] ${sheetSyncResult.isError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {sheetSyncResult.msg}
              </span>
            )}
          </div>,
        ]))}
      />
    </div>
  );
}

