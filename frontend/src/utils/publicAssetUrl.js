/**
 * Absolute URL for files under `/uploads/…` on the API host.
 * Uses the full API base + path (e.g. `https://api.example.com/api` + `/uploads/...`) so assets work when
 * the reverse proxy only routes `/api/*` to Nest — not `https://origin/uploads/...` alone.
 * Optional `VITE_UPLOADS_ORIGIN`: full prefix including `/api` if needed, e.g. `https://api.example.com/api`.
 */
export function resolveApiPublicUrl(path) {
  if (path == null || typeof path !== 'string') return '';
  let p = path.trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  p = p.replace(/^\/api\/uploads\//i, '/uploads/');
  const rel = p.startsWith('/') ? p : `/${p}`;

  const uploadsOverride = (import.meta.env.VITE_UPLOADS_ORIGIN || '').trim().replace(/\/$/, '');
  if (rel.startsWith('/uploads/') && /^https?:\/\//i.test(uploadsOverride)) {
    return `${uploadsOverride}${rel}`;
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

  if (rel.startsWith('/uploads/')) {
    if (/^https?:\/\//i.test(apiBase)) {
      return `${apiBase}${rel}`;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api${rel}`;
    }
    return `/api${rel}`;
  }

  if (/^https?:\/\//i.test(apiBase)) {
    try {
      const origin = new URL(apiBase).origin;
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
