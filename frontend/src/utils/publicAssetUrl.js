/**
 * Absolute URL for static files served by the API host (`/uploads/…`, `/api` is not part of the path).
 * Uses `VITE_API_BASE_URL` when it is absolute; otherwise `window.location.origin` (Vite dev proxy).
 */
export function resolveApiPublicUrl(path) {
  if (path == null || typeof path !== 'string') return '';
  let p = path.trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  // Mis-resolved paths like /api/uploads/… → /uploads/…
  p = p.replace(/^\/api\/uploads\//i, '/uploads/');
  const rel = p.startsWith('/') ? p : `/${p}`;
  const raw = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  if (/^https?:\/\//i.test(raw)) {
    try {
      const origin = new URL(raw).origin;
      return `${origin}${rel}`;
    } catch {
      return rel;
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${rel}`;
  }
  return rel;
}
