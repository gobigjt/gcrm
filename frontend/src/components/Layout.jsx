import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { resolveApiPublicUrl } from '../utils/publicAssetUrl';
import { useModules } from '../context/ModuleContext';
import { useTheme } from '../context/ThemeContext';

const PAGE_META = {
  '/': { title: 'Dashboard', cta: '+ New Lead', ctaTo: '/crm?tab=list' },
  '/crm': { title: 'CRM', cta: '+ New Lead', ctaTo: '/crm/leads/new' },
  '/crm/masters': { title: 'CRM Masters', cta: '+ New Lead', ctaTo: '/crm/leads/new' },
  '/sales': { title: 'Sales', cta: '+ Quotation', ctaTo: '/sales/quotes/new' },
  '/sales/quotes': { title: 'Quotations', cta: '+ Quotation', ctaTo: '/sales/quotes/new' },
  '/sales/orders': { title: 'Sale Orders', cta: '+ Order', ctaTo: '/sales/orders/new' },
  '/sales/invoices': { title: 'Invoices', cta: '+ Invoice', ctaTo: '/sales/invoices/new' },
  '/sales/payments': { title: 'Payment In', cta: null, ctaTo: null },
  '/sales/returns': { title: 'Sale Returns', cta: '+ Return', ctaTo: '/sales/returns' },
  '/sales/customers': { title: 'Customers', cta: '+ Customer', ctaTo: null },
  '/inventory': { title: 'Inventory', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/inventory/products': { title: 'Products', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/inventory/warehouses': { title: 'Warehouses', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/inventory/adjustments': { title: 'Stock Adjustment', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/inventory/brands': { title: 'Brands', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/inventory/categories': { title: 'Categories', cta: '+ Product', ctaTo: '/inventory/products/new' },
  '/hr': { title: 'HR', cta: '+ Employee', ctaTo: '/hr' },
  '/settings': { title: 'Settings', cta: 'Save All', ctaTo: '/settings' },
  '/profile': { title: 'Profile', cta: 'Open Settings', ctaTo: '/settings' },
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
      { to: '/crm/masters', label: 'Masters', icon: '◑', module: 'crm' },
    ],
  },
  {
    label: 'Sale',
    items: [
      { to: '/sales/invoices',  label: 'Invoices',    icon: '◫', module: 'sales' },
      { to: '/sales/payments',  label: 'Payment In',  icon: '₹', module: 'sales' },
      { to: '/sales/quotes',    label: 'Quotations',  icon: '❝', module: 'sales' },
      { to: '/sales/orders',    label: 'Sale Order',  icon: '◇', module: 'sales' },
      { to: '/sales/returns',   label: 'Sale Return', icon: '↩', module: 'sales' },
      { to: '/sales/customers', label: 'Customers',   icon: '◉', module: 'sales' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory/products', label: 'Products', icon: '◆', module: 'inventory' },
      { to: '/inventory/warehouses', label: 'Warehouses', icon: '◫', module: 'inventory' },
      { to: '/inventory/adjustments', label: 'Stock Adjustment', icon: '⇅', module: 'inventory' },
      { to: '/inventory/brands', label: 'Brands', icon: '◍', module: 'inventory' },
      { to: '/inventory/categories', label: 'Categories', icon: '◌', module: 'inventory' },
    ],
  },
  {
    label: 'Operations',
    items: [{ to: '/hr', label: 'HR', icon: '◉', module: 'hr' }],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users?tab=users', label: 'Users & Roles', icon: '◈', module: 'users' },
      { to: '/users?tab=permissions', label: 'Permissions', icon: '▦', module: 'users' },
      { to: '/settings', label: 'Settings', icon: '◌', module: 'settings' },
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
  const salesNavRoots = ['/sales/quotes', '/sales/orders', '/sales/invoices', '/sales/payments', '/sales/returns', '/sales/customers'];
  if (salesNavRoots.includes(path)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      if (wantHash) return (hash || '') === wantHash;
      return true;
    }
    return false;
  }
  if (pathname !== path) return false;
  if (wantHash) {
    return (hash || '') === wantHash;
  }
  const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if ([...want].length === 0) {
    if (path === '/settings' && (hash || '') !== '') return false;
    return true;
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
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Sales Executive': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  HR:            'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  default:       'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-300',
};

function displayRoleName(role) {
  return role === 'Super Admin' ? 'Admin' : role;
}

/** Remount when [src] changes so a failed image does not stick after a new URL is saved. */
function TopBarAvatar({ src, initial }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#eeedfe] text-[#3c3489] flex items-center justify-center text-xs font-semibold relative">
      {src && !failed ? (
        <img
          src={src}
          alt="Profile"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span
        className={`w-full h-full flex items-center justify-center ${src && !failed ? 'opacity-0' : ''}`}
        aria-hidden={Boolean(src && !failed)}
      >
        {initial}
      </span>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { canAccess } = useModules();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const pathRef = useRef(pathname);
  const [routeBusy, setRouteBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [companyBranding, setCompanyBranding] = useState({ logo_url: '', favicon_url: '', company_name: '' });

  useEffect(() => {
    api.get('/settings/company').then((r) => setCompanyBranding(r.data || {})).catch(() => {});
  }, []);

  useEffect(() => {
    const href = resolveApiPublicUrl(companyBranding?.favicon_url);
    if (!href || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }, [companyBranding?.favicon_url]);

  // Menu click / route change: top bar (BrowserRouter has no useNavigation; pathname is the signal).
  useLayoutEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    const t = window.setTimeout(() => {
      setRouteBusy(true);
      setMobileNavOpen(false);
      setUserMenuOpen(false);
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

  useEffect(() => {
    const onDown = (e) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

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

  const roleLabel = displayRoleName(user?.role);
  const roleCls = roleColors[roleLabel] || roleColors.default;
  const displayName = (user?.name || user?.email || 'User').toString().trim() || 'User';
  const avatarSrc = resolveApiPublicUrl(user?.avatar_url || user?.avatarUrl);
  const defaultLogoSrc = '/default-logo.png';
  const logoSrc = resolveApiPublicUrl(companyBranding?.logo_url) || defaultLogoSrc;
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
        <div className="h-[52px] border-b border-slate-200 dark:border-slate-700/50 px-3 flex items-center gap-2 w-full">
          <div className="flex items-center min-w-0 w-full justify-center md:justify-start">
            <img
              src={logoSrc}
              alt="Company logo"
              className="h-12 w-full max-w-[180px] rounded-md object-contain bg-white dark:bg-slate-900 p-0.5"
            />
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
            onClick={() => navigate(page.ctaTo)}
            className="btn-wf-primary shrink-0"
          >
            {page.cta}
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700
                       bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300
                       hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300
                       transition-colors"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleCls}`}>{roleLabel}</span>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-800 hover:border-brand-400"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <TopBarAvatar
                  key={`${user?.id ?? 'u'}-${avatarSrc || 'none'}`}
                  src={avatarSrc}
                  initial={displayName[0]?.toUpperCase() || 'U'}
                />
                <span className="max-w-[140px] truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={displayName}>
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#13152a] shadow-lg z-20 overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={async () => {
                      setUserMenuOpen(false);
                      await logout();
                      navigate('/login');
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-5 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
