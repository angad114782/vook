import { describe, expect, it } from 'vitest';
import { extractError } from './errorUtils';
import { statusLabel } from './friendly';

describe('friendly text', () => {
  it('turns machine statuses into plain words', () => {
    expect(statusLabel('NOTICE_PERIOD')).toBe('Serving notice');
    expect(statusLabel('PENDING_APPROVAL')).toBe('Pending Approval');
    expect(statusLabel(null)).toBe('—');
  });

  it('never leaks axios or HTTP jargon', () => {
    expect(extractError({ message: 'Network Error' })).toContain('could not reach the server');
    expect(extractError({ message: 'Request failed with status code 500', response: { status: 500, data: {} } })).toContain('our side');
    expect(extractError({ response: { status: 403, data: { error: { code: 'PERMISSION_DENIED', message: 'PERMISSION_DENIED: EMPLOYEE_MANAGEMENT.CREATE' } } } })).toContain('do not have permission');
  });

  it('keeps clear server messages', () => {
    expect(extractError({ response: { status: 422, data: { error: { code: 'X', message: 'Mobile number is already used.' } } } })).toBe('Mobile number is already used.');
  });
});
