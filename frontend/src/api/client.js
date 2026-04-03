import axios, { AxiosHeaders } from 'axios';

// Dev: leave unset → `/api` (Vite proxy → backend). Production: set in `.env.production`, e.g.
//   VITE_API_BASE_URL=https://your-api.up.railway.app/api
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const api = axios.create({ baseURL: API_BASE });

// In-memory access token — always in sync with localStorage after login/refresh (avoids re-reading races).
// Refresh only runs from the 401 response handler, never from the request interceptor.
let accessTokenMem = localStorage.getItem('access_token');

function setAccessToken(token) {
  accessTokenMem = token;
  if (token) localStorage.setItem('access_token', token);
  else localStorage.removeItem('access_token');
}

function clearSession() {
  accessTokenMem = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  delete api.defaults.headers.common.Authorization;
}

/** Sync memory when another tab or legacy code updates localStorage (best-effort). */
function readAccessToken() {
  const fromStore = localStorage.getItem('access_token');
  if (fromStore !== accessTokenMem) accessTokenMem = fromStore;
  return accessTokenMem;
}

// Single in-flight refresh — backend rotates refresh tokens; never parallel refresh calls.
let refreshing = null;

function isAuthRequestUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('/auth/login')
    || url.includes('/auth/register')
    || url.includes('/auth/refresh')
  );
}

function refreshSession() {
  if (refreshing) return refreshing;

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token'));
  }

  refreshing = axios
    .post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
    .then((res) => {
      const d = res.data;
      const access_token = d?.access_token;
      const newRefresh = d?.refresh_token;
      if (!access_token || !newRefresh) {
        throw new Error('Invalid refresh response');
      }
      setAccessToken(access_token);
      localStorage.setItem('refresh_token', newRefresh);
      api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
      return access_token;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

// ── Request: attach token (sync — no await, no refresh here) ──
api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    const h = AxiosHeaders.from(config.headers);
    h.set('Authorization', `Bearer ${token}`);
    config.headers = h;
  }
  return config;
});

// ── Response: refresh only on 401, then retry once ──
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status !== 401) {
      return Promise.reject(err);
    }
    if (!original || original._retry) {
      return Promise.reject(err);
    }

    const url = typeof original.url === 'string' ? original.url : '';
    if (isAuthRequestUrl(url)) {
      return Promise.reject(err);
    }

    if (!localStorage.getItem('refresh_token')) {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      const accessToken = await refreshSession();
      const headers = AxiosHeaders.from(original.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      original.headers = headers;
      return api.request(original);
    } catch {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }
  },
);

/** Call after login so memory + storage stay aligned. */
export function persistAccessToken(access_token) {
  setAccessToken(access_token);
  api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
}

export { clearSession };
export default api;
