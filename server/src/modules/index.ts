import { Router, type RequestHandler } from 'express';
import { accessRouter } from './access/routes.ts';
import { attendanceRouter } from './hr/attendance.ts';
import { leaveRouter } from './hr/leave.ts';
import { expenseRouter } from './finance/expenses.ts';
import { payrollRouter } from './finance/payroll.ts';
import { filesRouter } from './files/routes.ts';
import { billingRouter } from './platform/billing.ts';
import { companyDeviceRouter } from './hr/attendanceDevices.ts';
import { deviceRouter } from './platform/attendanceDevices.ts';
import { planRouter } from './platform/plans.ts';
import { rbacRouter } from './platform/rbac.ts';
import { engageRouter } from './engage/routes.ts';
import { employeeRouter } from './org/employees.ts';
import { orgRouter } from './org/routes.ts';
import { lookupRouter } from './org/lookups.ts';
import { tenantRouter } from './tenant/routes.ts';

/** Everything here sits behind `requireAuth` and the central `gate` (role, subscription, module, permission). */
export function apiRouter(requireAuth: RequestHandler, gate: RequestHandler) {
  const router = Router();
  const secured = Router();
  secured.use(requireAuth, gate);
  secured.use(accessRouter, tenantRouter, orgRouter, employeeRouter, attendanceRouter, leaveRouter, payrollRouter, expenseRouter, filesRouter, planRouter, rbacRouter, billingRouter, deviceRouter, companyDeviceRouter, lookupRouter, engageRouter);
  router.use(secured);
  return router;
}
