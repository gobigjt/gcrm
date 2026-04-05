import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

// ─── Constants ───────────────────────────────────────────────

const ALL_ROLES = ['Super Admin', 'Admin', 'Sales Executive', 'HR'];

const ROLE_COLORS = {
  'Super Admin': 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
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
          <button type="submit" className="btn-wf-primary">
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
                      ? `${ROLE_COLORS[role] ?? ROLE_COLORS.default} opacity-80 cursor-default`
                      : isOn
                        ? `${ROLE_COLORS[role] ?? ROLE_COLORS.default} hover:opacity-80 cursor-pointer`
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

  const load = useCallback(() => {
    api.get('/crm/lead-platforms/facebook/pages').then(r => setPages(r.data || [])).catch(() => {});
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
    </div>
  );
}

