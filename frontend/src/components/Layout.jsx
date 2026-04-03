import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModules } from '../context/ModuleContext';

const PAGE_META = {
  '/': { title: 'Dashboard', cta: '+ New Lead', ctaTo: '/crm?tab=list' },
  '/crm': { title: 'CRM', cta: '+ New Lead', ctaTo: '/crm?tab=list' },
  '/sales': { title: 'Sales', cta: '+ Quotation', ctaTo: '/sales?tab=quotations' },
  '/purchase': { title: 'Purchase', cta: '+ Purchase', ctaTo: '/purchase' },
  '/inventory': { title: 'Inventory', cta: '+ Product', ctaTo: '/inventory?tab=products' },
  '/production': { title: 'Production', cta: '+ Job Card', ctaTo: '/production' },
  '/finance': { title: 'Finance', cta: '+ Record', ctaTo: '/finance' },
  '/hr': { title: 'HR', cta: '+ Employee', ctaTo: '/hr' },
  '/communication': { title: 'Communication', cta: '+ Template', ctaTo: '/communication' },
  '/notifications': { title: 'Notifications', cta: 'View All', ctaTo: '/notifications' },
  '/settings': { title: 'Settings', cta: 'Save All', ctaTo: '/settings' },
  '/users': { title: 'Users & Roles', cta: '+ Invite User', ctaTo: '/users?tab=users' },
};

/** Wireframe-aligned sections (documents/EZcrm_web_1.html). */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: '▦', module: null }],
  },
  {
    label: 'CRM',
    items: [
      { to: '/crm?tab=list', label: 'Leads', icon: '◎', module: 'crm' },
      { to: '/crm?tab=contacts', label: 'Contacts', icon: '✦', module: 'crm' },
      { to: '/crm?tab=pipeline', label: 'Pipeline', icon: '⧉', module: 'crm' },
      { to: '/crm?tab=followups', label: 'Follow-ups', icon: '▤', module: 'crm' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/sales?tab=quotations', label: 'Quotations', icon: '◇', module: 'sales' },
      { to: '/sales?tab=invoices', label: 'Invoices', icon: '◫', module: 'sales' },
      { to: '/sales?tab=invoices&view=payments', label: 'Payments', icon: '◧', module: 'sales' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory?tab=products', label: 'Products', icon: '◆', module: 'inventory' },
      { to: '/inventory?tab=warehouses', label: 'Inventory', icon: '◫', module: 'inventory' },
      { to: '/purchase', label: 'Purchases', icon: '⊕', module: 'purchase' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/production', label: 'Production', icon: '⚙', module: 'production' },
      { to: '/hr', label: 'HR', icon: '◉', module: 'hr' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance?tab=gst', label: 'GST / Tax', icon: '◑', module: 'finance' },
      { to: '/finance?tab=reports', label: 'Reports', icon: '▥', module: 'finance' },
    ],
  },
  {
    label: 'Communication',
    items: [{ to: '/communication', label: 'WhatsApp', icon: '◐', module: 'communication' }],
  },
  {
    label: 'Admin',
    items: [
      { to: '/notifications', label: 'Notifications', icon: '◍', module: null },
      { to: '/users?tab=users', label: 'Users & Roles', icon: '◈', module: 'users' },
      { to: '/users?tab=permissions', label: 'Permissions', icon: '▦', module: 'users' },
      { to: '/settings', label: 'Settings', icon: '◌', module: 'settings' },
      { to: '/settings#billing', label: 'Billing', icon: '⌁', module: 'settings' },
      { to: '/settings#superadmin', label: 'Super Admin', icon: '★', module: null, roles: ['Super Admin'] },
    ],
  },
];

/** Active nav: path + query + optional hash (matches Link `to` strings). */
function navItemActive(pathname, search, hash, to) {
  let rest = to;
  let wantHash = '';
  const hi = rest.indexOf('#');
  if (hi >= 0) {
    wantHash = `#${rest.slice(hi + 1)}`;
    rest = rest.slice(0, hi);
  }
  const qi = rest.indexOf('?');
  const path = qi >= 0 ? rest.slice(0, qi) : rest;
  const want = new URLSearchParams(qi >= 0 ? rest.slice(qi + 1) : '');
  if (pathname !== path) return false;
  if (wantHash) {
    return (hash || '') === wantHash;
  }
  const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if ([...want].length === 0) {
    if (path === '/settings' && (hash || '') !== '') return false;
    return true;
  }

  if (path === '/sales' && want.get('tab') === 'invoices') {
    const wv = want.get('view') || '';
    if (want.has('view')) {
      return have.get('tab') === 'invoices' && (have.get('view') || '') === wv;
    }
    return have.get('tab') === 'invoices' && !(have.get('view') || '');
  }

  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) {
      if (path === '/crm' && k === 'tab' && v === 'list' && !have.get('tab')) return true;
      return false;
    }
  }
  return true;
}

const roleColors = {
  'Super Admin': 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Manager:       'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  Accountant:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  HR:            'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  Agent:         'bg-slate-200  text-slate-700  dark:bg-slate-800     dark:text-slate-300',
  default:       'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-300',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { canAccess } = useModules();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const pathRef = useRef(pathname);
  const [routeBusy, setRouteBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Menu click / route change: top bar (BrowserRouter has no useNavigation; pathname is the signal).
  useLayoutEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    const t = window.setTimeout(() => {
      setRouteBusy(true);
      setMobileNavOpen(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!routeBusy) return;
    const t = window.setTimeout(() => setRouteBusy(false), 380);
    return () => window.clearTimeout(t);
  }, [pathname, routeBusy]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const navTransitioning = routeBusy;

  const navSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(({ module, roles }) => {
          if (roles?.length && (!user?.role || !roles.includes(user.role))) return false;
          return canAccess(module);
        }),
      })).filter((section) => section.items.length > 0),
    [canAccess, user],
  );

  const roleCls = roleColors[user?.role] || roleColors.default;
  const pageKey = Object.keys(PAGE_META)
    .filter((p) => p === '/' || pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0] || '/';
  const page = PAGE_META[pageKey] || PAGE_META['/'];

  return (
    <div className="min-h-screen flex bg-[#f5f4ef] dark:bg-[#0d0f1a] transition-colors duration-200">

      {navTransitioning && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden bg-slate-200/80 dark:bg-slate-700/80"
          role="progressbar"
          aria-label="Page loading"
        >
          <div className="h-full w-1/3 bg-gradient-to-r from-brand-400 to-brand-600 animate-[navIndeterminate_1s_ease-in-out_infinite]" />
        </div>
      )}

      <style>{`
        @keyframes navIndeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`
          flex flex-col flex-shrink-0 w-[220px] bg-white dark:bg-[#13152a] border-r border-slate-200 dark:border-slate-700/50 overflow-y-auto
          fixed inset-y-0 left-0 z-[91] transition-transform duration-200 ease-out shadow-xl md:shadow-none
          md:relative md:inset-auto md:z-auto md:translate-x-0
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
          ${!mobileNavOpen ? 'max-md:pointer-events-none' : ''}
        `}
      >
        <div className="h-[52px] border-b border-slate-200 dark:border-slate-700/50 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#534ab7] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">EZ</div>
            <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 truncate">EzCRM Pro</div>
          </div>
          <button
            type="button"
            className="md:hidden p-2 -mr-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="py-2 flex-1">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              <div className="px-4 py-1 text-[10px] uppercase tracking-[0.06em] font-semibold text-slate-400 dark:text-slate-500">{section.label}</div>
              {section.items.map(({ to, label, icon }) => {
                const active = navItemActive(pathname, search, hash, to);
                return (
                  <Link
                    key={`${section.label}-${label}-${to}`}
                    to={to}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-[7px] text-[13px] border-l-2 transition-colors ${
                      active
                        ? 'text-[#534ab7] bg-[#eeedfe] dark:bg-[#2a2558] border-l-[#534ab7] font-medium'
                        : 'text-slate-500 dark:text-slate-300 border-l-transparent hover:bg-[#f5f4ef] dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-sm leading-none opacity-80">{icon}</span>
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="min-h-[52px] bg-white dark:bg-[#13152a] border-b border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center gap-x-2 gap-y-2 px-4 sm:px-5 py-2 md:py-0 md:h-[52px] md:flex-nowrap">
          <button
            type="button"
            className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 basis-[40%] sm:basis-auto">
            <div className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 truncate">{page.title}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Home / {page.title}</div>
          </div>
          <div className="hidden md:block flex-1" />
          <button
            onClick={() => navigate('/notifications')}
            className="btn-wf-secondary hidden sm:inline-flex"
          >
            Notifications
          </button>
          <button
            onClick={() => navigate('/communication')}
            className="btn-wf-secondary hidden sm:inline-flex"
          >
            WhatsApp
          </button>
          <button
            onClick={() => navigate(page.ctaTo)}
            className="btn-wf-primary shrink-0"
          >
            {page.cta}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#eeedfe] text-[#3c3489] flex items-center justify-center text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleCls}`}>{user?.role}</span>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-5 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
