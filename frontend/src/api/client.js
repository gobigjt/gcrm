import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Request: attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────
// Backend rotates refresh tokens on every /auth/refresh. Parallel refresh calls
// revoke each other's tokens → some requests stay on stale access tokens and get 401.
// All 401s must await the same in-flight refresh promise (no queue + second refresh).

let refreshPromise = null;

function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

function refreshSession() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return Promise.reject(new Error('No refresh token'));
    }
    refreshPromise = axios
      .post('/api/auth/refresh', { refresh_token: refreshToken })
      .then(({ data }) => {
        const { access_token, refresh_token: newRefresh } = data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', newRefresh);
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        return access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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
    if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')) {
      return Promise.reject(err);
    }

    if (!localStorage.getItem('refresh_token')) {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      await refreshSession();
      if (original.headers) {
        if (typeof original.headers.delete === 'function') {
          original.headers.delete('Authorization');
        } else {
          delete original.headers.Authorization;
        }
      }
      return api(original);
    } catch {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }
  },
);

export default api;
