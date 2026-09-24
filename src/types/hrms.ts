export type EntityId = string;

export interface MutableRecord {
  id: EntityId;
  companyId: EntityId;
  version: number;
  createdAt: string;
  updatedAt: string;
  permittedActions: string[];
}

export type EmployeeLifecycle =
  | 'DRAFT'
  | 'INVITED'
  | 'PREBOARDING'
  | 'ACTIVE'
  | 'PROBATION'
  | 'NOTICE_PERIOD'
  | 'EXITED'
  | 'ARCHIVED';

export type OrganizationUnitType = 'COMPANY' | 'BRANCH' | 'DEPARTMENT' | 'TEAM' | 'COST_CENTRE';

export interface OrganizationUnit extends MutableRecord {
  type: OrganizationUnitType;
  name: string;
  code: string;
  parentId: EntityId | null;
  isActive: boolean;
}

export type HolidayKind = 'NATIONAL' | 'STATE' | 'COMPANY' | 'RESTRICTED';

export interface HolidayCalendar extends MutableRecord {
  name: string;
  year: number;
  stateCode: string | null;
  branchIds: EntityId[];
  employeeGroupIds: EntityId[];
  holidays: Holiday[];
}

export interface Holiday {
  id: EntityId;
  name: string;
  date: string;
  kind: HolidayKind;
  optional: boolean;
}

export interface LeavePolicy extends MutableRecord {
  name: string;
  leaveType: string;
  annualEntitlement: number;
  accrual: 'UPFRONT' | 'MONTHLY' | 'QUARTERLY';
  carryForwardLimit: number;
  allowNegativeBalance: boolean;
  allowHalfDay: boolean;
  sandwichRule: boolean;
  documentRequiredAfterDays: number | null;
}

export interface LeaveBalance {
  employeeId: EntityId;
  policyId: EntityId;
  opening: number;
  accrued: number;
  used: number;
  pending: number;
  available: number;
  projected: number;
}

export interface AttendanceException extends MutableRecord {
  employeeId: EntityId;
  date: string;
  type: 'MISSED_PUNCH' | 'LATE' | 'EARLY_EXIT' | 'DUPLICATE_PUNCH' | 'OUTSIDE_GEOFENCE';
  status: 'OPEN' | 'REQUESTED' | 'RESOLVED' | 'WAIVED';
  evidence: Record<string, unknown>;
}

export interface AttendancePeriod extends MutableRecord {
  month: number;
  year: number;
  status: 'OPEN' | 'LOCKED';
  lockedBy: EntityId | null;
  lockedAt: string | null;
}

export interface ShiftRoster extends MutableRecord {
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'PUBLISHED';
  assignmentCount: number;
  conflictCount: number;
}

export interface SalaryComponent {
  id: EntityId;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
  calculation: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  taxable: boolean;
  value: number;
}

export interface SalaryTemplate extends MutableRecord {
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  components: SalaryComponent[];
}

export interface SalaryAssignment extends MutableRecord {
  employeeId: EntityId;
  salaryTemplateId: EntityId;
  annualCtc: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export type PayrollRunStatus =
  | 'DRAFT'
  | 'INPUTS_PENDING'
  | 'VALIDATION_FAILED'
  | 'READY'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'FINALIZED'
  | 'PUBLISHED'
  | 'PAYMENT_PROCESSING'
  | 'PAID';

export interface PayrollValidationIssue {
  id: EntityId;
  employeeId: EntityId | null;
  severity: 'BLOCKER' | 'WARNING';
  source: 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'SALARY' | 'STATUTORY' | 'EXPENSE';
  title: string;
  message: string;
  resolutionPath: string;
}

export interface PayrollRun extends MutableRecord {
  month: number;
  year: number;
  status: PayrollRunStatus;
  employeeCount: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  validationIssues: PayrollValidationIssue[];
}

export interface PayrollRunEmployee {
  employeeId: EntityId;
  payrollRunId: EntityId;
  payableDays: number;
  unpaidDays: number;
  overtimeMinutes: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  onHold: boolean;
}

export interface StatutoryProfile extends MutableRecord {
  employeeId: EntityId;
  panMasked: string | null;
  aadhaarMasked: string | null;
  uan: string | null;
  esicNumber: string | null;
  taxRegime: 'OLD' | 'NEW' | null;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTaxState: string | null;
}

export interface ApprovalInstance extends MutableRecord {
  entityType: string;
  entityId: EntityId;
  workflowType: string;
  currentStep: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
  dueAt: string | null;
}

export interface AuditTimelineEvent {
  id: EntityId;
  entityType: string;
  entityId: EntityId;
  action: string;
  actorName: string;
  occurredAt: string;
  reason: string | null;
}

export interface ListQuery {
  search?: string;
  filters?: Record<string, string | string[] | number | boolean | undefined>;
  sort?: { field: string; direction: 'asc' | 'desc' };
  page?: number;
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
}

export interface ListResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; nextCursor?: string | null };
  aggregates?: Record<string, number>;
}

export interface MutationCommand<T> {
  data: T;
  version?: number;
  idempotencyKey: string;
  auditReason?: string;
}

export interface FieldViolation {
  field: string;
  message: string;
  code?: string;
}
