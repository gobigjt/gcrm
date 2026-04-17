import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api, { persistAccessToken, clearSession } from '../api/client';

const AuthContext = createContext(null);
const LAST_TENANT_SLUG_KEY = 'last_tenant_slug';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('access_token');
    const u = readStoredUser();
    if (u && !token) {
      localStorage.removeItem('user');
      clearSession();
      return null;
    }
    if (token) persistAccessToken(token);
    return u;
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const u = readStoredUser();
    if (u && !token) {
      localStorage.removeItem('user');
      setUser(null);
      delete api.defaults.headers.common.Authorization;
      return;
    }
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  const login = useCallback(async (email, password, tenantSlug = '') => {
    const payload = { email, password };
    const slug = String(tenantSlug || '').trim().toLowerCase();
    if (slug) payload.tenant_slug = slug;
    const res = await api.post('/auth/login', payload);
    const { access_token, refresh_token, user: rawUser } = res.data;
    const u = { ...(rawUser || {}) };
    if (slug) {
      u.tenant_slug = slug;
      localStorage.setItem(LAST_TENANT_SLUG_KEY, slug);
    } else {
      // If user signs in without tenant URL (e.g., Super Admin), clear stale tenant redirect.
      localStorage.removeItem(LAST_TENANT_SLUG_KEY);
    }
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(u));
    persistAccessToken(access_token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    try {
      if (refresh_token) await api.post('/auth/logout', { refresh_token });
    } catch {
      // ignore — we're logging out regardless
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api.get('/auth/me');
    const u = r.data;
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
    }
    return u;
  }, []);

  // Keep header avatar in sync (e.g. after upload, or older cached `user` without `avatar_url`).
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    void (async () => {
      try {
        await refreshUser();
      } catch {
        /* offline / expired token — keep existing session state */
      }
    })();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
