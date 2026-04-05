import { describe, expect, it } from 'vitest';

import {
  SALES_FROM_LEAD_PARAM,
  salesFromLeadPath,
  salesFromLeadQuery,
} from './salesFromLeadUrl.js';

describe('salesFromLeadQuery', () => {
  it('uses fixed param name', () => {
    expect(SALES_FROM_LEAD_PARAM).toBe('fromLead');
  });

  it('encodes numeric id', () => {
    expect(salesFromLeadQuery(7)).toBe('fromLead=7');
  });

  it('encodes string id', () => {
    expect(salesFromLeadQuery('12')).toBe('fromLead=12');
  });

  it('encodes special characters', () => {
    expect(salesFromLeadQuery('1&2')).toBe('fromLead=1%262');
  });
});

describe('salesFromLeadPath', () => {
  it('prefixes /sales', () => {
    expect(salesFromLeadPath(99)).toBe('/sales?fromLead=99');
  });
});
