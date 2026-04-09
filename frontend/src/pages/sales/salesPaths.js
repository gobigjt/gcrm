/** @typedef {'quotes'|'orders'|'invoices'} SalesUrlSegment */

/** @param {SalesUrlSegment} seg */
export function salesListPath(seg) {
  return `/sales/${seg}`;
}

/**
 * @param {SalesUrlSegment} seg
 * @param {string} [search] e.g. `?customerId=1` or `customerId=1`
 */
export function salesNewPath(seg, search = '') {
  const q = search && (search.startsWith('?') ? search : `?${search}`);
  return `/sales/${seg}/new${q}`;
}

/** @param {SalesUrlSegment} seg */
export function salesViewPath(seg, id) {
  return `/sales/${seg}/${id}`;
}

/** @param {SalesUrlSegment} seg */
export function salesEditPath(seg, id) {
  return `/sales/${seg}/${id}/edit`;
}
