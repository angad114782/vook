import type { AppNotification } from '../api/notifications';

export type NotificationRole = 'HR' | 'MANAGER' | 'SUPERVISOR' | 'FINANCE' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'SUPER_ADMIN';
export type NotificationCategory = 'leave' | 'attendance' | 'approvals' | 'payroll' | 'documents' | 'support' | 'company' | 'general';

const workspaceForRole: Record<NotificationRole, string> = {
  HR: '/hr',
  MANAGER: '/manager',
  SUPERVISOR: '/supervisor',
  FINANCE: '/finance',
  COMPANY_ADMIN: '/company-admin',
  EMPLOYEE: '/employee',
  SUPER_ADMIN: '/company-admin',
};

export function isNotificationUnread(notification: AppNotification): boolean {
  return notification.isRead !== true && !notification.readAt;
}

export function getNotificationCategory(notification: AppNotification): NotificationCategory {
  const source = [notification.category, notification.eventType, notification.type, notification.entityType, notification.title]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (source.includes('support') || source.includes('ticket')) return 'support';
  if (source.includes('attendance') || source.includes('shift') || source.includes('clock')) return 'attendance';
  if (source.includes('payroll') || source.includes('payslip') || source.includes('salary')) return 'payroll';
  if (source.includes('document') || source.includes('policy') || source.includes('compliance')) return 'documents';
  if (source.includes('approval') || source.includes('approver')) return 'approvals';
  if (source.includes('leave') || source.includes('time off')) return 'leave';
  if (source.includes('subscription') || source.includes('company') || source.includes('broadcast')) return 'company';
  return 'general';
}

export function getNotificationCategoryLabel(category: NotificationCategory): string {
  const labels: Record<NotificationCategory, string> = {
    leave: 'Leave & requests',
    attendance: 'Attendance',
    approvals: 'Approvals',
    payroll: 'Payroll & payslips',
    documents: 'Documents & policies',
    support: 'Support',
    company: 'Company updates',
    general: 'Other updates',
  };
  return labels[category];
}

export function getNotificationDestination(notification: AppNotification, role: NotificationRole): string {
  const workspace = workspaceForRole[role];
  const category = getNotificationCategory(notification);
  const type = (notification.type ?? notification.eventType ?? '').toLowerCase();
  const ticketId = notification.entityId ?? notification.data?.ticketId;

  if (category === 'support' && typeof ticketId === 'string') {
    if (role === 'COMPANY_ADMIN') return workspace + '/support?ticket=' + encodeURIComponent(ticketId);
    if (role === 'SUPER_ADMIN') return '/support?ticket=' + encodeURIComponent(ticketId);
  }
  if (category === 'company' && type.includes('subscription') && role === 'COMPANY_ADMIN') {
    return workspace + '/plan';
  }
  if (category === 'leave') {
    return workspace + (role === 'EMPLOYEE' ? '/leaves' : '/approvals');
  }
  if (category === 'approvals') return workspace + (role === 'EMPLOYEE' ? '/leaves' : '/approvals');
  if (category === 'attendance') {
    return ['HR', 'MANAGER', 'SUPERVISOR', 'COMPANY_ADMIN', 'EMPLOYEE'].includes(role)
      ? workspace + '/attendance'
      : workspace + '/dashboard';
  }
  if (category === 'payroll') {
    if (role === 'EMPLOYEE') return workspace + '/payslips';
    if (role === 'COMPANY_ADMIN') return workspace + '/payroll/overview';
    if (role === 'MANAGER' || role === 'SUPERVISOR') return workspace + '/workforce';
    return workspace + '/payroll';
  }
  if (category === 'documents') {
    return role === 'EMPLOYEE' || role === 'HR' ? workspace + '/documents' : workspace + '/dashboard';
  }
  return workspace + '/dashboard';
}
