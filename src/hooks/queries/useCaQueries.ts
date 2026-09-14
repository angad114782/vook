import { useQuery } from '@tanstack/react-query';
import { caApi } from '../../api/companyAdmin';
import { qk } from '../../lib/queryKeys';

export const useCaDashboard = () =>
  useQuery({
    queryKey: qk.ca.dashboard(),
    queryFn: () => caApi.getDashboard().then((r) => r.data),
  });

export const useCaUsers = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.ca.users(params),
    queryFn: () => caApi.getUsers(params).then((r) => r.data),
  });

export const useCaDepartments = () =>
  useQuery({
    queryKey: qk.ca.departments(),
    queryFn: () => caApi.getDepartments().then((r) => r.data),
  });

export const useCaCompany = () =>
  useQuery({
    queryKey: qk.ca.company(),
    queryFn: () => caApi.getCompany().then((r) => r.data),
  });

export const useCaModules = () =>
  useQuery({
    queryKey: qk.ca.modules(),
    queryFn: () => caApi.getModules().then((r) => r.data),
  });

export const useCaActivity = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.ca.activity(params),
    queryFn: () => caApi.getActivity(params).then((r) => r.data),
  });

export const useRolePermissions = () =>
  useQuery({
    queryKey: qk.ca.rolePermissions(),
    queryFn: () => caApi.getRolePermissions().then((r) => r.data),
  });

export const useWorkflows = () =>
  useQuery({
    queryKey: qk.ca.workflows(),
    queryFn: () => caApi.getWorkflows().then((r) => r.data),
  });

export const useCaWorkforceReport = (enabled = false) =>
  useQuery({
    queryKey: qk.ca.report('workforce'),
    queryFn: () => caApi.getWorkforceReport().then((r) => r.data),
    enabled,
  });

export const useCaLeaveReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.ca.report('leave', params),
    queryFn: () => caApi.getLeaveReport(params).then((r) => r.data),
    enabled,
  });

export const useCaPayrollReport = (params?: { from?: string; to?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.ca.report('payroll', params),
    queryFn: () => caApi.getPayrollReport(params).then((r) => r.data),
    enabled,
  });

export const useCaAttendanceReport = (params?: { year?: string; month?: string }, enabled = false) =>
  useQuery({
    queryKey: qk.ca.report('attendance', params),
    queryFn: () => caApi.getAttendanceReport(params).then((r) => r.data),
    enabled,
  });
