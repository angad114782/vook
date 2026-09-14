import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../../api/hr';
import { qk } from '../../lib/queryKeys';

export const useEmployees = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.employees(params),
    queryFn: () => hrApi.getEmployees(params).then((r) => r.data),
  });

export const useEmployee = (id: string) =>
  useQuery({
    queryKey: qk.hr.employee(id),
    queryFn: () => hrApi.getEmployee(id).then((r) => r.data),
    enabled: !!id,
  });

export const useHrDepartments = () =>
  useQuery({
    queryKey: qk.hr.departments(),
    queryFn: () => hrApi.getDepartments().then((r) => r.data),
  });

export const useHrAttendance = () =>
  useQuery({
    queryKey: qk.hr.attendance(),
    queryFn: () => hrApi.getAttendance().then((r) => r.data),
  });

export const useAttendanceRecords = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.attendanceRecords(params),
    queryFn: () => hrApi.getAttendanceRecords(params).then((r) => r.data),
  });

export const useLeaves = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.leaves(params),
    queryFn: () => hrApi.getLeaves(params).then((r) => r.data),
  });

export const useApprovals = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.approvals(params),
    queryFn: () => hrApi.getApprovals(params).then((r) => r.data),
  });

export const useHrSalary = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.salary(params),
    queryFn: () => hrApi.getSalary(params).then((r) => r.data),
  });

export const useHrPayslips = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.payslips(params),
    queryFn: () => hrApi.getPayslips(params).then((r) => r.data),
  });

export const useShifts = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.shifts(params),
    queryFn: () => hrApi.getShifts(params).then((r) => r.data),
  });

export const useDocuments = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.hr.documents(params),
    queryFn: () => hrApi.getDocuments(params).then((r) => r.data),
  });
