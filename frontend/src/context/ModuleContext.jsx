import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ModuleContext = createContext({ modules: [], loaded: false, canAccess: () => true });

export function ModuleProvider({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [modules, setModules] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const prevUserIdRef = useRef(null);

  // Re-fetch modules when user changes, or in background on route change (do not set loaded=false
  // on navigation — that unmounted the whole shell and fired dozens of parallel authed requests).
  useEffect(() => {
    if (!user) {
      setModules([]);
      setLoaded(true);
      prevUserIdRef.current = null;
      return;
    }

    const userChanged = user.id !== prevUserIdRef.current;
    prevUserIdRef.current = user.id;
    if (userChanged) setLoaded(false);

    let cancelled = false;
    api
      .get('/settings/modules')
      .then((r) => {
        if (!cancelled) setModules(r.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const canAccess = (moduleKey) => {
    if (!moduleKey) return true;
    if (user?.role === 'Super Admin') return true;
    const cfg = modules.find(m => m.module === moduleKey);
    if (!cfg) return true;
    if (!cfg.is_enabled) return false;
    return (cfg.allowed_roles || []).includes(user?.role);
  };

  return (
    <ModuleContext.Provider value={{ modules, loaded, canAccess }}>
      {children}
    </ModuleContext.Provider>
  );
}

export const useModules = () => useContext(ModuleContext);
