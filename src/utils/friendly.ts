/** Plain-language labels for machine values. Anything shown to a user goes through here, never raw enums. */
const STATUS_LABELS: Record<string, string> = {
  NOTICE_PERIOD: 'Serving notice',
  START_NOTICE: 'Serving notice',
  ONBOARDING: 'Joining soon',
  PREBOARDING: 'Joining soon',
  PROBATION: 'On probation',
  INVITED: 'Invitation sent',
  NOT_CREATED: 'No login yet',
  NOT_STARTED: 'Not started',
  INPUTS_PENDING: 'Waiting for inputs',
  UNDER_REVIEW: 'Under review',
  MANAGER_APPROVED: 'Approved by manager',
  FINANCE_APPROVED: 'Approved by finance',
  VALIDATION_FAILED: 'Needs correction',
  PAST_DUE: 'Payment overdue',
  CALCULATED: 'Calculated',
  FINALIZED: 'Locked',
  EXITED: 'Left company',
  ARCHIVED: 'Archived',
  SUPER_ADMIN: 'Platform admin',
  COMPANY_ADMIN: 'Company admin',
  HR: 'HR',
};

export function titleCase(value: string): string {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const key = value.toUpperCase().replaceAll(' ', '_');
  return STATUS_LABELS[key] ?? titleCase(value);
}

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  FORBIDDEN: 'You do not have access to this. Ask your admin if you need it.',
  PERMISSION_DENIED: 'You do not have permission to do this. Ask your admin if you need it.',
  SCOPE_DENIED: 'This belongs to a team or department you do not manage.',
  ENTITLEMENT_REQUIRED: 'This feature is not part of your current plan. Upgrade your plan to use it.',
  TENANT_INACTIVE: 'Your subscription needs attention before you can make changes. Open Subscription & billing.',
  VERSION_CONFLICT: 'Someone else changed this just now. Please refresh and try again.',
  EMPLOYEE_LIMIT_REACHED: 'Your plan’s employee limit is full. Upgrade the plan to add more people.',
  AUDIT_REASON_REQUIRED: 'Please add a short reason for this change.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  NOT_FOUND: 'We could not find this. It may have been removed.',
};

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do this. Ask your admin if you need it.',
  404: 'We could not find this. It may have been removed.',
  409: 'This changed while you were working. Please refresh and try again.',
  413: 'That file is too big. Please choose a smaller one.',
  422: 'Some details need fixing. Please check the form and try again.',
  429: 'Too many attempts. Please wait a minute and try again.',
};

/** Technical wording that must never reach a user (axios/HTTP/dev jargon). */
const TECHNICAL = /status code|axios|network error|econn|timeout of|cors|http \d|undefined|\bnull\b|\bjson\b|stack|exception|_[A-Z]{2,}|\b[A-Z]{3,}_[A-Z_]+\b/i;

export const isHumanMessage = (message: unknown): message is string =>
  typeof message === 'string' && message.trim().length > 3 && !TECHNICAL.test(message);

export function friendlyErrorMessage(opts: { code?: string; status?: number; serverMessage?: unknown; hasResponse: boolean; fallback: string }): string {
  const { code, status, serverMessage, hasResponse, fallback } = opts;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]!;
  if (isHumanMessage(serverMessage)) return serverMessage;
  if (!hasResponse) return 'We could not reach the server. Check your internet connection and try again.';
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]!;
  if (status && status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return fallback;
}
