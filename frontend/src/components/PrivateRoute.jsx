import { Navigate } from 'react-router-dom';
import { useAuth }    from '../context/AuthContext';
import { useModules } from '../context/ModuleContext';
import Layout from './Layout';

export default function PrivateRoute({ children, module }) {
  const { user }              = useAuth();
  const { canAccess, loaded } = useModules();

  if (!user) return <Navigate to="/login" replace />;

  // Wait for module settings to load before making access decisions,
  // so we never flash a redirect and never flash-allow blocked content.
  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f6fa] dark:bg-[#0d0f1a] transition-colors">
        <div
          className="h-10 w-10 rounded-full border-2 border-slate-200 dark:border-slate-600 border-t-brand-500 dark:border-t-brand-400 animate-spin"
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Loading workspace…</p>
      </div>
    );
  }

  if (!canAccess(module)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}
