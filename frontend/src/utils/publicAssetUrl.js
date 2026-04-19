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
  // Legacy bucket URL support: convert raw Railway endpoint URL to backend proxy path.
  // This keeps existing DB rows rendering even if bucket endpoint is private.
  const bucketEndpoint = (import.meta.env.VITE_RAILWAY_BUCKET_ENDPOINT || '').trim().replace(/\/$/, '');
  const bucketName = (import.meta.env.VITE_RAILWAY_BUCKET_NAME || '').trim();
  if (bucketEndpoint && bucketName && p.toLowerCase().startsWith(`${bucketEndpoint.toLowerCase()}/${bucketName.toLowerCase()}/`)) {
    const key = p.slice(`${bucketEndpoint}/${bucketName}/`.length);
    p = `/uploads/bucket/${key}`;
  }
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      if (u.hostname.toLowerCase().includes('storageapi.dev')) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          p = `/uploads/bucket/${parts.slice(1).join('/')}`;
        }
      }
    } catch {
      /* keep as-is */
    }
  }
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
