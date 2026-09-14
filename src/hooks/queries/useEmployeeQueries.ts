import { useQuery } from '@tanstack/react-query';
import { employeeApi } from '../../api/employee';
import { qk } from '../../lib/queryKeys';

export const useMyProfile = () =>
  useQuery({
    queryKey: qk.emp.profile(),
    queryFn: () => employeeApi.getProfile().then((r) => r.data),
  });

export const useMyAttendance = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.emp.attendance(params),
    queryFn: () => employeeApi.getAttendance(params).then((r) => r.data),
  });

export const useTodayAttendance = () =>
  useQuery({
    queryKey: qk.emp.todayStatus(),
    queryFn: () => employeeApi.getTodayAttendance().then((r) => r.data),
    staleTime: 60 * 1000,
  });

export const useMyLeaves = () =>
  useQuery({
    queryKey: qk.emp.leaves(),
    queryFn: () => employeeApi.getLeaves().then((r) => r.data),
  });

export const useMyPayslips = () =>
  useQuery({
    queryKey: qk.emp.payslips(),
    queryFn: () => employeeApi.getPayslips().then((r) => r.data),
  });

export const useMyExpenses = () =>
  useQuery({
    queryKey: qk.emp.expenses(),
    queryFn: () => employeeApi.getExpenses().then((r) => r.data),
  });

export const useMyDocuments = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.emp.documents(params),
    queryFn: () => employeeApi.getDocuments(params).then((r) => r.data),
  });
