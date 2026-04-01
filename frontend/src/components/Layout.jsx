import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }    from '../context/AuthContext';
import { useTheme }   from '../context/ThemeContext';
import { useModules } from '../context/ModuleContext';

const ALL_NAV = [
  { to: '/',               label: 'Dashboard',   icon: '▦', module: null },
  { to: '/crm',           label: 'CRM',          icon: '◎', module: 'crm' },
  { to: '/sales',         label: 'Sales',        icon: '◈', module: 'sales' },
  { to: '/purchase',      label: 'Purchase',     icon: '⊕', module: 'purchase' },
  { to: '/inventory',     label: 'Inventory',    icon: '◫', module: 'inventory' },
  { to: '/production',    label: 'Production',   icon: '⚙', module: 'production' },
  { to: '/finance',       label: 'Finance',      icon: '◑', module: 'finance' },
  { to: '/hr',            label: 'HR & Payroll', icon: '◉', module: 'hr' },
  { to: '/communication', label: 'Comms',        icon: '◐', module: 'communication' },
  { to: '/notifications', label: 'Notifications',icon: '◍', module: null },
  { to: '/settings',      label: 'Settings',     icon: '◌', module: 'settings' },
  { to: '/users',         label: 'Users',        icon: '◈', module: 'users' },
];

const roleColors = {
  'Super Admin': 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
  Admin:         'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Manager:       'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  Accountant:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  HR:            'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  Agent:         'bg-slate-200  text-slate-700  dark:bg-slate-800     dark:text-slate-300',
  default:       'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-300',
};

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`relative flex items-center w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none
        ${dark ? 'bg-brand-500' : 'bg-slate-200'}`}>
      <span className="absolute left-1 text-[10px] leading-none select-none">
        {dark ? '🌙' : ''}
      </span>
      <span className="absolute right-1 text-[10px] leading-none select-none">
        {!dark ? '☀️' : ''}
      </span>
      <span className={`absolute w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-300
        ${dark ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { canAccess } = useModules();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const [routeBusy, setRouteBusy] = useState(false);

  // Menu click / route change: top bar (BrowserRouter has no useNavigation; pathname is the signal).
  useLayoutEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setRouteBusy(true);
  }, [pathname]);

  useEffect(() => {
    if (!routeBusy) return;
    const t = window.setTimeout(() => setRouteBusy(false), 380);
    return () => window.clearTimeout(t);
  }, [pathname, routeBusy]);

  const navTransitioning = routeBusy;

  // Filter nav: always show Dashboard; for modules check access via shared context
  const nav = ALL_NAV.filter(({ module }) => canAccess(module));

  const roleCls = roleColors[user?.role] || roleColors.default;

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f6fa] dark:bg-[#0d0f1a] transition-colors duration-200">

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

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40
        bg-white/95 dark:bg-[#13152a]/95
        border-b border-slate-200/80 dark:border-slate-700/50
        shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]
        backdrop-blur-sm">

        {/* Brand + user row */}
        <div className="flex items-center justify-between px-6 h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold leading-none">B</span>
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              BuildConstruct
            </span>
            <span className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <span className="hidden sm:block text-xs text-slate-400 dark:text-slate-500 font-medium">
              CRM + ERP
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {user?.name}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleCls}`}>
                {user?.role}
              </span>
            </div>

            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-all duration-150">
              Sign out
            </button>
          </div>
        </div>

        {/* Nav row */}
        <div className="px-4 border-t border-slate-100 dark:border-slate-700/50 overflow-x-auto">
          <nav className="flex items-center gap-0.5 h-10">
            {nav.map(({ to, label, icon }) => {
              const active = pathname === to || (to !== '/' && pathname.startsWith(to));
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150
                    ${active
                      ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  <span className={`text-sm leading-none ${active ? 'text-brand-500 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {icon}
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-screen-xl mx-auto px-6 py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
