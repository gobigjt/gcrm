/**
 * Absolute URL for static files served by the API host (`/uploads/…`, `/api` is not part of the path).
 * - If `VITE_API_BASE_URL` is absolute (e.g. `https://api.example.com/api`), uses that host’s origin.
 * - Optional `VITE_UPLOADS_ORIGIN` (e.g. `https://api.example.com`) when the SPA is on another domain
 *   but uploads still live on the API host (overrides origin for paths under `/uploads/` only).
 * - Otherwise `window.location.origin` (Vite dev proxy forwards `/uploads` to the API).
 */
export function resolveApiPublicUrl(path) {
  if (path == null || typeof path !== 'string') return '';
  let p = path.trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  // Mis-resolved paths like /api/uploads/… → /uploads/…
  p = p.replace(/^\/api\/uploads\//i, '/uploads/');
  const rel = p.startsWith('/') ? p : `/${p}`;

  const uploadsOriginRaw = (import.meta.env.VITE_UPLOADS_ORIGIN || '').trim().replace(/\/$/, '');
  if (rel.startsWith('/uploads/') && /^https?:\/\//i.test(uploadsOriginRaw)) {
    try {
      return `${new URL(uploadsOriginRaw).origin}${rel}`;
    } catch {
      /* fall through */
    }
  }

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
