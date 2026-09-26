import api from './axios';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string; employeeId: string; department: string | null; designation: string | null;
  mobile?: string | null;
  shiftType: string | null; shiftTiming: string | null; joiningDate: string | null;
  annualCtc: number | null; employmentType: string; status: string;
  bankName: string | null; branchName: string | null; accountHolder: string | null;
  version?: number; user: { id: string | null; name: string; email: string; role: string | null; accountStatus?: 'NOT_CREATED' | 'INVITED' | 'ACTIVE' | 'SUSPENDED'; lastLoginAt?: string | null };
}

export interface LeaveRequest {
  id: string; leaveType: string; startDate: string; endDate: string; days: number;
  reason: string | null; status: string; version?: number; createdAt: string;
  employee: { id: string; employeeId: string; department: string | null; user: { name: string; email: string } };
}

export interface Approval {
  id: string; type: string; details: string; date: string; priority: string; status: string; createdAt: string;
  employee: { id: string; employeeId: string; user: { name: string } };
}

export interface SalaryRow {
  id: string; employeeId: string; name: string; department: string | null;
  designation: string | null; employmentType: string; annualCtc: number | null; basicAnnual?: number | null; allowancesAnnual?: number | null; deductionsAnnual?: number | null; effectiveFrom?: string | null; lastRevised: string | null;
}

export interface Payslip {
  id: string; payslipId: string; period: string; month: number; year: number;
  grossSalary: number; totalDeductions: number; netPay: number; status: string; paymentStatus?: string; paidAt?: string;
  snapshot?: {
    calculationVersion?: string; annualCtc?: number; monthDays?: number; payableDays?: number; absentDays?: number;
    basicSalary?: number; allowances?: number; overtimeMinutes?: number; overtimePay?: number; reimbursementAmount?: number;
    configuredDeductions?: number; absenceDeduction?: number;
  };
  employee: { id: string; employeeId: string; user: { name: string } };
}

export interface Document {
  id: string; name: string; category: string; uploadedBy: string; fileSize: string | null;
  version: string | null; visibility: string; createdAt: string; fileUrl?: string | null;
}

export interface AttendanceRecord {
  id: string; date: string; checkIn: string | null; checkOut: string | null; status: string; source: string;
  employeeId: {
    id: string; employeeId: string; department: string | null; designation: string | null;
    userId: { name: string };
  };
}

export interface AttendancePeriod {
  id: string; companyId: string; month: number; year: number; status: 'OPEN' | 'LOCKED';
  version: number; lockedBy?: string | null; lockedAt?: string | null; updatedAt: string;
}

export interface AttendanceRegularizationReview {
  id: string; date: string; requestedCheckIn?: string | null; requestedCheckOut?: string | null;
  reason: string; status: string; approvalStage: string; createdAt: string;
  employee: { id: string; employeeId: string; department: string | null; user: { name: string } };
  history?: Array<{ role: string; action: string; comment?: string | null; at: string }>;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  name: string;
  workerCode: string;
  dept: string;
  role: string;
  shift: string;
  shiftName: 'Morning' | 'Evening' | 'Night';
  status: string;
}

export interface ShiftPlan {
  department: string;
  shift: 'Morning' | 'Evening' | 'Night';
  required: number;
  assigned: number;
  shortage: number;
}

export interface ShiftShortage {
  station: string;
  shift: string;
  required: number;
  actual: number;
  severity: string;
}

export interface Pagination {
  total: number; page: number; limit: number; totalPages: number;
}

// ── API ────────────────────────────────────────────────────────────────────────

export const hrApi = {
  // Employees
  getEmployees: (p?: Record<string, string>) => api.get<{ employees: Employee[]; pagination: Pagination; stats: { total: number; active: number; inactive: number; departments: number } }>('/hr/employees', { params: p }),
  getEmployee:  (id: string)                 => api.get<Employee>(`/hr/employees/${id}`),
  createEmployee: (data: Record<string, unknown>, idempotencyKey?: string) => api.post<Employee & { invitationSent?: boolean; invitationToken?: string }>('/hr/employees', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  updateEmployee: (id: string, data: Record<string, string>) => api.patch<Employee>(`/hr/employees/${id}`, data),
  employeeAction: (id: string, data: { action: string; version: number; reason: string }) => api.post<Employee>(`/hr/employees/${id}/actions`, data),
  getDepartments: ()                         => api.get<{ name: string; count: number }[]>('/hr/employees/departments'),

  // Attendance
  getAttendance: () => api.get<{ stats: { totalWorkforce: number; perm: number; cont: number; presentToday: number; presentPct: number; absent: number; absentPct: number; lateArrivals: number; avgDelay: number }; departments: { department: string; total: number; present: number; percentage: number }[] }>('/hr/attendance'),
  getAttendanceRecords: (p?: Record<string, string>) => api.get<{ records: AttendanceRecord[]; pagination: Pagination }>('/hr/attendance/records', { params: p }),
  createAttendanceRecord: (data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; status: string; notes?: string }) => api.post<AttendanceRecord>('/hr/attendance', data),
  getAttendancePeriod: (month: number, year: number) => api.get<AttendancePeriod>('/attendance-periods/current', { params: { month, year } }),
  lockAttendancePeriod: (month: number, year: number, version: number) => api.post<AttendancePeriod>('/attendance-periods/lock', { month, year, version }),
  getAttendanceRegularizations: () => api.get<{ regularizations: AttendanceRegularizationReview[] }>('/attendance-regularizations'),
  attendanceRegularizationAction: (id: string, action: 'APPROVE' | 'REJECT', comment: string) => api.post(`/attendance-regularizations/${id}/actions`, { action, comment }),
  getShifts: (p?: Record<string, string>) => api.get<{
    stats: { totalWorkers: number; morningShift: number; eveningShift: number; nightShift: number };
    shifts: { Morning: ShiftAssignment[]; Evening: ShiftAssignment[]; Night: ShiftAssignment[] };
    plans: ShiftPlan[];
    shortages: ShiftShortage[];
  }>('/hr/shifts', { params: p }),
  createShift: (data: { employeeId: string; date: string; shiftName: 'Morning' | 'Evening' | 'Night'; startTime?: string; endTime?: string; notes?: string }) =>
    api.post('/hr/shifts', data),
  updateShift: (id: string, data: { shiftName?: 'Morning' | 'Evening' | 'Night'; startTime?: string; endTime?: string; status?: 'Assigned' | 'Completed' | 'Cancelled'; notes?: string }) =>
    api.patch(`/hr/shifts/${id}`, data),
  getAttendancePolicy: () => api.get<{ standardStart: string; standardEnd: string; graceMinutes: number; overtimeAfterMinutes: number; breakMinutes: number; weeklyOffs: number[] }>('/hr/attendance-policy'),
  updateAttendancePolicy: (data: { standardStart: string; standardEnd: string; graceMinutes: number; overtimeAfterMinutes: number; breakMinutes: number; weeklyOffs: number[] }) => api.put('/hr/attendance-policy', data),

  // Leaves
  getLeaves: (p?: Record<string, string>) => api.get<{ leaves: LeaveRequest[]; pagination: Pagination; stats: { total: number; pending: number; approved: number; rejected: number; filtered?: boolean } }>('/hr/leaves', { params: p }),
  updateLeave: (id: string, status: string) => api.patch(`/hr/leaves/${id}`, { status }),
  leaveAction: (id: string, data: { action: string; version?: number; reason?: string }) => api.post(`/hr/leaves/${id}/actions`, data),

  // Approvals
  getApprovals: (p?: Record<string, string>) => api.get<{ approvals: Approval[]; pagination: Pagination; stats: { pending: number; approvedToday: number; rejected: number; escalated: number } }>('/hr/approvals', { params: p }),
  updateApproval: (id: string, status: string) => api.patch(`/hr/approvals/${id}`, { status }),

  // Payroll
  getSalary:   (p?: Record<string, string>) => api.get<{ results: SalaryRow[]; pagination: Pagination }>('/hr/payroll/salary', { params: p }),
  saveSalary: (data: { employeeId: string; annualCtc: number; basicAnnual?: number; allowancesAnnual?: number; deductionsAnnual?: number; effectiveFrom?: string }) => api.post('/hr/payroll/salary', data),
  getPayslips: (p?: Record<string, string>) => api.get<{ payslips: Payslip[]; pagination: Pagination }>('/hr/payroll/payslips', { params: p }),
  downloadPayslip: (id: string) => api.get<Blob>(`/hr/payroll/payslips/${id}/download`, { responseType: 'blob' }),
  markPayslipPaid: (id: string) => api.post<Payslip>(`/hr/payroll/payslips/${id}/pay`),
  recalculatePayslip: (id: string) => api.post<Payslip>(`/hr/payroll/payslips/${id}/recalculate`),
  runPayroll: (data: { month: number; year: number; employeeIds?: string[] }) =>
    api.post<{ message: string; period: string; month: number; year: number; created: number; skipped: number; runId: string }>('/hr/payroll/run', data),
  finalizePayroll: (id: string) => api.post(`/hr/payroll/runs/${id}/finalize`),

  // Reports
  getWorkforceReport: () => api.get('/hr/reports/workforce'),
  getLeaveReport: (p?: { from?: string; to?: string }) => api.get('/hr/reports/leave', { params: p }),
  getPayrollReport: (p?: { from?: string; to?: string }) => api.get('/hr/reports/payroll', { params: p }),
  getAttendanceReport: (p?: { year?: string; month?: string }) => api.get('/hr/reports/attendance', { params: p }),

  // Documents
  getDocuments:   (p?: Record<string, string>) => api.get<{ documents: Document[]; pagination: Pagination }>('/hr/documents', { params: p }),
  uploadDocumentFile: (file: File) => {
    const fd = new FormData();
    fd.append('document', file);
    return api.post<{ fileUrl: string; fileSize: string; name: string }>('/hr/documents/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  createDocument: (data: Record<string, string>) => api.post<Document>('/hr/documents', data),
  deleteDocument: (id: string)                  => api.delete(`/hr/documents/${id}`),
  downloadDocument: (fileUrl: string) => api.get<Blob>(fileUrl.replace(/^\/api/, ''), { responseType: 'blob' }),
};
