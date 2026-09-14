import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../../api/hr';
import { qk } from '../../lib/queryKeys';

export const useMgrWorkforce = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.mgr.workforce(params),
    queryFn: () => hrApi.getEmployees(params).then((r) => r.data),
  });

export const useMgrAttendance = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.mgr.attendance(params),
    queryFn: () => hrApi.getAttendanceRecords(params).then((r) => r.data),
  });

export const useMgrApprovals = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.mgr.approvals(params),
    queryFn: () => hrApi.getApprovals(params).then((r) => r.data),
  });

export const useMgrWorkforceReport = (enabled = false) =>
  useQuery({
    queryKey: qk.mgr.report('workforce'),
    queryFn: () => hrApi.getWorkforceReport().then((r) => r.data),
    enabled,
  });

export const useMgrLeaveReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.mgr.report('leave', params),
    queryFn: () => hrApi.getLeaveReport(params).then((r) => r.data),
    enabled,
  });

export const useMgrPayrollReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.mgr.report('payroll', params),
    queryFn: () => hrApi.getPayrollReport(params).then((r) => r.data),
    enabled,
  });

export const useMgrAttendanceReport = (params?: { year?: string; month?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.mgr.report('attendance', params),
    queryFn: () => hrApi.getAttendanceReport(params).then((r) => r.data),
    enabled,
  });
