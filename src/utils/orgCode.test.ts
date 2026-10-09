import { describe, expect, it } from 'vitest';
import { makeOrgCode } from './orgCode';

describe('makeOrgCode', () => {
  it('uses initials for multi-word names and a prefix for single words', () => {
    expect(makeOrgCode('Human Resources')).toBe('HR');
    expect(makeOrgCode('Engineering')).toBe('ENGI');
  });
  it('keeps codes unique', () => {
    expect(makeOrgCode('Human Resources', ['HR', 'hr2'])).toBe('HR3');
  });
  it('falls back for symbol-only names', () => {
    expect(makeOrgCode('###')).toBe('ORG');
  });
});
