import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.ts';
import { effectiveEntitlements, effectivePermissions, subscriptionAccess } from '../domain/access.ts';

const MODULE_RULES: Array<[RegExp, string]> = [
  [/^\/employees/, 'EMPLOYEE_MANAGEMENT'], [/^\/(departments|designations|offices|branches|teams|reporting-lines)/, 'ORGANIZATION'],
  [/^\/attendance-verification-policy/, 'ATTENDANCE'], [/^\/attendance-integrations/, 'ATTENDANCE'], [/^\/attendance-regularizations/, 'ATTENDANCE'],
  [/^\/attendance-periods/, 'ATTENDANCE'], [/^\/attendance/, 'ATTENDANCE'], [/^\/shifts/, 'SHIFT_MANAGEMENT'],
  [/^\/leave-requests|^\/leave-types|^\/holiday-calendars/, 'LEAVE_MANAGEMENT'], [/^\/approvals|^\/workflows/, 'APPROVALS'],
  [/^\/salaries|^\/payroll-runs|^\/payroll-compliance/, 'PAYROLL'], [/^\/payslips/, 'PAYSLIPS'],
  [/^\/expenses/, 'EXPENSE_MANAGEMENT'], [/^\/documents|^\/files\/documents/, 'DOCUMENTS'], [/^\/reports/, 'REPORTS_ANALYTICS'],
];

/** Central route policy: role gates, subscription state, module entitlement, then permission — in that order. */
export const gate: RequestHandler = async (req, _res, next) => {
  const user = req.ctx.user;
  if (!user) return next();
  const { path, method } = req;
  const role = user.role;

  const superAdminOnly = path === '/broadcasts' || path.startsWith('/broadcasts/') || path === '/settings/platform'
    || (path.startsWith('/companies') && path !== '/companies/options')
    || (path.startsWith('/subscriptions') && path !== '/subscription')
    || (path.startsWith('/payments') && path !== '/payments/mine' && role !== 'FINANCE')
    || (path.startsWith('/plans') && method !== 'GET')
    || path.startsWith('/entitlement-overrides')
    || path.startsWith('/attendance-providers') || (path.startsWith('/attendance-integrations') && method !== 'GET')
    || path.startsWith('/integrations') || path.startsWith('/modules') || path === '/reports/revenue-trend'
    || (path.startsWith('/module-catalog') && method !== 'GET');
  if (superAdminOnly && role !== 'SUPER_ADMIN') throw new AppError(403, 'FORBIDDEN', 'This operation requires Super Admin access.');
  if (path.startsWith('/users') && !['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role)) throw new AppError(403, 'FORBIDDEN', 'User administration is not available for this role.');
  if ((path.startsWith('/role-definitions') || path.startsWith('/role-assignments') || path.startsWith('/role-permissions')) && role !== 'COMPANY_ADMIN' && !(role === 'SUPER_ADMIN' && method === 'GET')) {
    throw new AppError(403, 'FORBIDDEN', 'Only the Company Admin can configure tenant roles and scopes.');
  }
  if (path.startsWith('/employees') && role === 'EMPLOYEE') throw new AppError(403, 'FORBIDDEN', 'Employee directory access is not available for this role.');

  if (role !== 'SUPER_ADMIN' && user.companyId) {
    // Department / designation / branch names are the shared org directory: every signed-in tenant user needs them for filters and pickers.
    const orgDirectoryRead = method === 'GET' && /^\/(departments(\/summary)?|designations|offices|branches)$/.test(path);
    const rule = orgDirectoryRead ? undefined : MODULE_RULES.find(([pattern]) => pattern.test(path));
    if (rule) {
      const ent = await effectiveEntitlements(user.companyId);
      const sub = subscriptionAccess(ent.subscription);
      if (sub?.readOnly) throw new AppError(403, 'TENANT_INACTIVE', 'Operational access is locked until the subscription is restored.', { subscriptionState: sub.state });
      if (!ent.modules.some((m) => m.key === rule[1] && m.enabled)) throw new AppError(403, 'ENTITLEMENT_REQUIRED', 'This module is not included in the company subscription.', { module: rule[1] });
      const permissions = await effectivePermissions(user);
      const action = method === 'GET' ? 'VIEW' : method === 'POST' ? 'CREATE' : 'EDIT';
      const workflowAction = path.includes('/actions') || /^\/payroll-runs\/[^/]+\/(review|approve|finalize|publish)$/.test(path) || (/^\/(approvals|expenses|leave-requests)\/[^/]+$/.test(path) && method === 'PATCH');
      const domainAction = workflowAction ? null : path.includes('/finalize') ? 'FINALIZE' : path === '/payroll-runs' && method === 'POST' ? 'PROCESS' : action;
      if (domainAction && !permissions.includes('*') && !permissions.includes(`${rule[1]}.${domainAction}`)) {
        throw new AppError(403, 'PERMISSION_DENIED', 'Your role does not grant this action.', { permission: `${rule[1]}.${domainAction}` });
      }
    }
  }
  next();
};
