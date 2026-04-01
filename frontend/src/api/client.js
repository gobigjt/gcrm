import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Request: attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  failedQueue = [];
}

function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only handle 401; anything else just propagates
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
      const { access_token, refresh_token: newRefresh } = data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', newRefresh);

      api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
      original.headers.Authorization = `Bearer ${access_token}`;

      processQueue(null, access_token);
      // Must await: otherwise `finally` runs immediately, isRefreshing clears while retries are
      // still in flight and parallel 401s can trigger multiple refreshes (revoking each other's tokens).
      return await api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearSession();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
