/** Normalize Axios / API error payload for display. */
export function apiErrorMessage(err, fallback = 'Something went wrong') {
  const m = err?.response?.data?.message;
  if (Array.isArray(m)) return m.join(' ');
  if (m != null && String(m).trim()) return String(m);
  if (err?.message) return String(err.message);
  return fallback;
}
