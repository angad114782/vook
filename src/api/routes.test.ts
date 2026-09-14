import { describe, expect, it } from 'vitest';
import { toV2ResourcePath } from './routes';

describe('v2 route compatibility translator', () => {
  it.each([
    ['/hr/employees', '/employees'],
    ['/finance/expenses', '/expenses'],
    ['/employee/leaves', '/leave-requests/mine'],
    ['/company-admin/departments', '/departments'],
    ['/subscriptions/plans', '/plans'],
    ['/support/ticket_1/comments', '/support-tickets/ticket_1/comments'],
  ])('maps %s to %s', (legacy, resource) => expect(toV2ResourcePath(legacy)).toBe(resource));

  it('leaves an already resource-oriented path unchanged', () => {
    expect(toV2ResourcePath('/employees')).toBe('/employees');
  });
});
