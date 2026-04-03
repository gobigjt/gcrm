/**
 * @param {{ origin: string, basePath: string, leadId: number|string }} p
 * @param {string} p.basePath Vite `BASE_URL` with trailing slash stripped (e.g. "" or "/app")
 */
export function buildWebCrmLeadUrl({ origin, basePath, leadId }) {
  const id = String(leadId);
  const root = `${origin}${basePath}/`;
  return new URL(`crm?lead=${encodeURIComponent(id)}`, root).href;
}

/** Custom URL scheme registered in the EZCRM mobile app. */
export function buildAppCrmLeadUrl(leadId) {
  return `ezcrm://crm?lead=${encodeURIComponent(String(leadId))}`;
}
