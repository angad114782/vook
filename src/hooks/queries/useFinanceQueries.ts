import { useQuery } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { qk } from '../../lib/queryKeys';

export const useFinanceAttendance = () =>
  useQuery({
    queryKey: qk.finance.attendance(),
    queryFn: () => financeApi.getAttendance().then((r) => r.data),
  });

export const useFinanceEmployees = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.finance.employees(params),
    queryFn: () => financeApi.getEmployees(params).then((r) => r.data),
  });

export const useFinanceSalary = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.finance.salary(params),
    queryFn: () => financeApi.getSalary(params).then((r) => r.data),
  });

export const useFinancePayslips = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.finance.payslips(params),
    queryFn: () => financeApi.getPayslips(params).then((r) => r.data),
  });

export const useFinanceExpenses = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.finance.expenses(params),
    queryFn: () => financeApi.getExpenses(params).then((r) => r.data),
  });

export const useFinanceWorkforceReport = (enabled = false) =>
  useQuery({
    queryKey: qk.finance.report('workforce'),
    queryFn: () => financeApi.getWorkforceReport().then((r) => r.data),
    enabled,
  });

export const useFinanceLeaveReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.finance.report('leave', params),
    queryFn: () => financeApi.getLeaveReport(params).then((r) => r.data),
    enabled,
  });

export const useFinancePayrollReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.finance.report('payroll', params),
    queryFn: () => financeApi.getPayrollReport(params).then((r) => r.data),
    enabled,
  });

export const useFinanceAttendanceReport = (params?: { year?: string; month?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.finance.report('attendance', params),
    queryFn: () => financeApi.getAttendanceReport(params).then((r) => r.data),
    enabled,
  });
