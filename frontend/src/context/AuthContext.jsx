import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

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
      return null;
    }
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
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

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token, user: u } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(u));
    api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common.Authorization;
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
