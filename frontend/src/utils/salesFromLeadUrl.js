/** Query param name shared with [Sales.jsx] (`useSearchParams().get('fromLead')`). */
export const SALES_FROM_LEAD_PARAM = 'fromLead';

/**
 * Query segment only, e.g. `fromLead=42` (encoded).
 * @param {number|string} leadId
 */
export function salesFromLeadQuery(leadId) {
  return `${SALES_FROM_LEAD_PARAM}=${encodeURIComponent(String(leadId))}`;
}

/**
 * React Router `to` value for opening Sales with CRM handoff banner.
 * @param {number|string} leadId
 */
export function salesFromLeadPath(leadId) {
  return `/sales?${salesFromLeadQuery(leadId)}`;
}
