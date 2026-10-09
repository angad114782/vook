import { coll } from './mongo.ts';
import type { CollectionName } from './repo.ts';

type Spec = [Record<string, 1 | -1>, Record<string, unknown>?];
// Every tenant-owned collection leads with companyId so each query hits one tenant's slice of the index.
const INDEXES: Partial<Record<CollectionName, Spec[]>> = {
  // A mobile number identifies exactly one login across the platform (partial: people without a mobile are not indexed).
  users: [[{ emailLower: 1 }, { unique: true }], [{ companyId: 1, role: 1 }], [{ mobileKey: 1 }, { unique: true, partialFilterExpression: { mobileKey: { $type: 'string' } } }]],
  otpCodes: [[{ mobileKey: 1 }], [{ expireAt: 1 }, { expireAfterSeconds: 0 }]],
  authThrottle: [[{ expireAt: 1 }, { expireAfterSeconds: 0 }]],
  sessions: [[{ userId: 1 }], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  employees: [[{ companyId: 1, status: 1 }], [{ companyId: 1, userId: 1 }], [{ companyId: 1, departmentId: 1 }], [{ companyId: 1, mobileKey: 1 }], [{ companyId: 1, createdAt: -1 }]],
  departments: [[{ companyId: 1, name: 1 }]],
  designations: [[{ companyId: 1, name: 1 }]],
  offices: [[{ companyId: 1 }]],
  teams: [[{ companyId: 1 }]],
  reportingLines: [[{ companyId: 1, employeeId: 1 }]],
  attendance: [[{ companyId: 1, date: -1 }], [{ employeeId: 1, date: 1 }, { unique: true }]],
  attendanceEvents: [[{ companyId: 1, employeeId: 1, occurredAt: -1 }]],
  attendanceRegularizations: [[{ companyId: 1, status: 1 }], [{ employeeId: 1, createdAt: -1 }]],
  attendancePeriods: [[{ companyId: 1, year: 1, month: 1 }]],
  holidayCalendars: [[{ companyId: 1, year: 1 }]],
  leaves: [[{ companyId: 1, status: 1, createdAt: -1 }], [{ employeeId: 1, createdAt: -1 }]],
  approvals: [[{ companyId: 1, status: 1, createdAt: -1 }]],
  salaries: [[{ companyId: 1, employeeId: 1 }]],
  salaryHistory: [[{ employeeId: 1, version: -1 }]],
  files: [[{ companyId: 1, createdAt: -1 }]],
  payrollRuns: [[{ companyId: 1, createdAt: -1 }]],
  payslips: [[{ companyId: 1, status: 1 }], [{ employeeId: 1, createdAt: -1 }]],
  expenses: [[{ companyId: 1, status: 1, createdAt: -1 }], [{ employeeId: 1, createdAt: -1 }]],
  documents: [[{ companyId: 1, createdAt: -1 }]],
  notifications: [[{ userId: 1, createdAt: -1 }], [{ companyId: 1, createdAt: -1 }]],
  tickets: [[{ companyId: 1, status: 1, updatedAt: -1 }]],
  comments: [[{ ticketId: 1, createdAt: 1 }]],
  activity: [[{ companyId: 1, createdAt: -1 }]],
  audit: [[{ companyId: 1, createdAt: -1 }], [{ entityType: 1, entityId: 1 }]],
  payments: [[{ companyId: 1, createdAt: -1 }]],
  invoices: [[{ companyId: 1, issuedAt: -1 }]],
  subscriptions: [[{ companyId: 1 }]],
  entitlementOverrides: [[{ companyId: 1 }]],
  roleDefinitions: [[{ companyId: 1, key: 1 }]],
  roleAssignments: [[{ companyId: 1, userId: 1 }]],
  planVersions: [[{ planId: 1, version: 1 }, { unique: true }]],
  idempotency: [[{ key: 1, userId: 1 }, { unique: true }], [{ createdAt: 1 }, { expireAfterSeconds: 86_400 }]],
  registrations: [[{ adminEmail: 1 }]],
  attendanceProviders: [[{ key: 1 }, { unique: true }]],
  // A physical device (identified by its serial on a connection) belongs to exactly one company and branch.
  lookups: [[{ scope: 1, type: 1 }]],
  attendanceDevices: [[{ connectionId: 1, serial: 1 }, { unique: true }], [{ companyId: 1, status: 1 }]],
  attendanceIntegrations: [[{ apiKeyHash: 1 }, { unique: true, partialFilterExpression: { apiKeyHash: { $type: 'string' } } }], [{ providerKey: 1 }]],
};

export async function ensureIndexes() {
  await Promise.all(Object.entries(INDEXES).flatMap(([name, specs]) => (specs ?? []).map(([keys, opts]) => coll(name).createIndex(keys, opts))));
}
