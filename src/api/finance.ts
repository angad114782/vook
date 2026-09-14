import api from './axios';
import type { Employee, SalaryRow, Payslip, Pagination } from './hr';

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  receiptUrl?: string | null;
  status: string;
  createdAt: string;
  employee: { id: string; employeeId: string; user: { name: string } };
}

export interface AttendanceStats {
  totalWorkforce: number; perm: number; cont: number;
  presentToday: number; presentPct: number;
  absent: number; absentPct: number;
  lateArrivals: number; avgDelay: number;
}

export const financeApi = {
  getAttendance: () =>
    api.get<{ stats: AttendanceStats; departments: { department: string; total: number; present: number; percentage: number }[] }>('/finance/attendance'),
  getEmployees: (p?: Record<string, string>) =>
    api.get<{ employees: Employee[]; stats: Record<string, number>; pagination: Pagination }>('/finance/employees', { params: p }),
  getSalary: (p?: Record<string, string>) =>
    api.get<{ results: SalaryRow[]; pagination: Pagination }>('/finance/salary', { params: p }),
  getPayslips: (p?: Record<string, string>) =>
    api.get<{ payslips: Payslip[]; pagination: Pagination }>('/finance/payslips', { params: p }),
  runPayroll: (data: { month: number; year: number; employeeIds?: string[] }) =>
    api.post<{ message: string; period: string; month: number; year: number; created: number; skipped: number }>('/finance/payroll/run', data),
  downloadPayslip: (id: string) => api.get<Blob>(`/finance/payslips/${id}/download`, { responseType: 'blob' }),
  markPayslipPaid: (id: string) => api.post<Payslip>(`/finance/payroll/payslips/${id}/pay`),
  recalculatePayslip: (id: string) => api.post<Payslip>(`/finance/payroll/payslips/${id}/recalculate`),
  getWorkforceReport: () => api.get('/finance/reports/workforce'),
  getLeaveReport: (p?: { from?: string; to?: string }) => api.get('/finance/reports/leave', { params: p }),
  getPayrollReport: (p?: { from?: string; to?: string }) => api.get('/finance/reports/payroll', { params: p }),
  getAttendanceReport: (p?: { year?: string; month?: string }) => api.get('/finance/reports/attendance', { params: p }),
  getExpenses: (p?: Record<string, string>) =>
    api.get<{ expenses: Expense[]; pagination: Pagination; stats: { pending: number; approved: number; rejected: number } }>('/finance/expenses', { params: p }),
  updateExpense: (id: string, status: string) =>
    api.patch(`/finance/expenses/${id}`, { status }),
};
