import api from './axios';
import type { Pagination } from './hr';

export interface AttendanceRecord {
  date: string; day: string; status: string;
  checkIn: string; checkOut: string; hours: string; ot: string;
}

export interface LeaveBalance {
  type: string; total: number; used: number; remaining: number;
}

export interface MyLeave {
  id: string; leaveType: string; startDate: string; endDate: string;
  days: number; reason: string | null; status: string; createdAt: string;
}

export interface MyPayslip {
  id: string; payslipId: string; period: string; month: number; year: number;
  grossSalary: number; totalDeductions: number; netPay: number; status: string; createdAt: string;
  snapshot?: {
    calculationVersion?: string; monthDays?: number; payableDays?: number; absentDays?: number;
    basicSalary?: number; allowances?: number; overtimeMinutes?: number; overtimePay?: number; reimbursementAmount?: number;
    configuredDeductions?: number; absenceDeduction?: number;
  };
}

export interface MyExpense {
  id: string; category: string; amount: number;
  description: string | null; status: string; createdAt: string;
  receiptUrl?: string | null;
}

export interface MyDocument {
  id: string; name: string; category: string; fileSize: string | null;
  version: string | null; visibility: string; uploadedBy: string; createdAt: string;
  fileUrl?: string | null;
}

export interface TodayAttendance {
  id: string; date: string; checkIn: string | null; checkOut: string | null; status: string;
}
export interface AttendanceRegularization {
  id: string; date: string; requestedCheckIn?: string | null; requestedCheckOut?: string | null;
  reason: string; status: string; approvalStage: string; createdAt: string;
  history?: Array<{ role: string; action: string; comment?: string | null; at: string }>;
}
export interface AttendanceLocation { latitude: number; longitude: number; accuracyMeters: number }

export const employeeApi = {
  getProfile:          () => api.get('/employee/profile'),
  getAttendance:       (p?: Record<string, string>) => api.get<{ records: AttendanceRecord[]; stats: { present: number; late: number; absent: number; totalHours: number; workingDays: number } }>('/employee/attendance', { params: p }),
  getTodayAttendance:  () => api.get<{ record: TodayAttendance | null }>('/employee/attendance/today'),
  checkIn:             (location?: AttendanceLocation) => api.post<{ message: string; record: TodayAttendance }>('/employee/attendance/checkin', location ?? {}),
  checkOut:            (location?: AttendanceLocation) => api.post<{ message: string; record: TodayAttendance }>('/employee/attendance/checkout', location ?? {}),
  getRegularizations:  () => api.get<{ regularizations: AttendanceRegularization[] }>('/attendance-regularizations/mine'),
  requestRegularization: (data: { date: string; requestedCheckIn?: string; requestedCheckOut?: string; reason: string }) => api.post('/attendance-regularizations/mine', data),
  getLeaves:           () => api.get<{ leaves: MyLeave[]; stats: Record<string, number>; balance: LeaveBalance[] }>('/employee/leaves'),
  applyLeave:    (data: { leaveType: string; startDate: string; endDate: string; reason: string }) => api.post('/employee/leaves', data),
  getPayslips:   () => api.get<MyPayslip[]>('/employee/payslips'),
  downloadPayslip: (id: string) => api.get<Blob>(`/employee/payslips/${id}/download`, { responseType: 'blob' }),
  getExpenses:   () => api.get<{ expenses: MyExpense[]; stats: { pending: number; approved: number; total: number } }>('/employee/expenses'),
  uploadReceiptFile: (file: File) => {
    const fd = new FormData();
    fd.append('receipt', file);
    return api.post<{ fileUrl: string }>('/employee/expenses/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  submitExpense: (data: { category: string; amount: number; description: string; receiptUrl?: string }) => api.post('/employee/expenses', data),
  getDocuments:  (p?: Record<string, string>) => api.get<{ documents: MyDocument[]; pagination: Pagination }>('/employee/documents', { params: p }),
  downloadDocument: (fileUrl: string) => api.get<Blob>(fileUrl.replace(/^\/api/, ''), { responseType: 'blob' }),
  updateProfile: (data: { name?: string; email?: string }) => api.patch<{ name: string; email: string }>('/employee/profile', data),
};
