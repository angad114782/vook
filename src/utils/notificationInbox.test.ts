import { describe, expect, it } from 'vitest';
import type { AppNotification } from '../api/notifications';
import { getNotificationCategory, getNotificationDestination, isNotificationUnread } from './notificationInbox';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notification_1',
    title: 'Leave request received',
    message: 'Your request is awaiting review.',
    type: 'LEAVE',
    createdAt: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

describe('notification inbox helpers', () => {
  it('classifies HRMS events from both current and legacy API fields', () => {
    expect(getNotificationCategory(notification())).toBe('leave');
    expect(getNotificationCategory(notification({ type: 'PAYROLL', title: 'Payslip published' }))).toBe('payroll');
    expect(getNotificationCategory(notification({ entityType: 'SupportTicket', title: 'New support reply' }))).toBe('support');
  });

  it('treats either API read marker as read', () => {
    expect(isNotificationUnread(notification())).toBe(true);
    expect(isNotificationUnread(notification({ isRead: true }))).toBe(false);
    expect(isNotificationUnread(notification({ readAt: '2026-09-15T10:00:00.000Z' }))).toBe(false);
  });

  it('routes notification actions to the signed-in role’s HRMS workspace', () => {
    expect(getNotificationDestination(notification(), 'EMPLOYEE')).toBe('/employee/leaves');
    expect(getNotificationDestination(notification({ type: 'APPROVAL' }), 'EMPLOYEE')).toBe('/employee/leaves');
    expect(getNotificationDestination(notification(), 'HR')).toBe('/hr/approvals');
    expect(getNotificationDestination(notification({ type: 'PAYROLL' }), 'FINANCE')).toBe('/finance/payroll');
    expect(getNotificationDestination(notification({ type: 'SUPPORT', entityType: 'SupportTicket', entityId: 'ticket/1' }), 'COMPANY_ADMIN'))
      .toBe('/company-admin/support?ticket=ticket%2F1');
  });
});
