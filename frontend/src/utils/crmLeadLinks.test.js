import { describe, expect, it } from 'vitest';

import { buildAppCrmLeadUrl, buildWebCrmLeadUrl } from './crmLeadLinks.js';

describe('buildWebCrmLeadUrl', () => {
  it('builds default base path', () => {
    expect(buildWebCrmLeadUrl({ origin: 'https://x.com', basePath: '', leadId: 7 })).toBe(
      'https://x.com/crm?lead=7',
    );
  });

  it('respects subpath base', () => {
    expect(buildWebCrmLeadUrl({ origin: 'https://x.com', basePath: '/portal', leadId: 42 })).toBe(
      'https://x.com/portal/crm?lead=42',
    );
  });
});

describe('buildAppCrmLeadUrl', () => {
  it('uses ezcrm scheme', () => {
    expect(buildAppCrmLeadUrl(99)).toBe('ezcrm://crm?lead=99');
  });
});
