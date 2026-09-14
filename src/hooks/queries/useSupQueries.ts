import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../../api/hr';
import { qk } from '../../lib/queryKeys';

export const useSupWorkforce = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sup.workforce(params),
    queryFn: () => hrApi.getEmployees(params).then((r) => r.data),
  });

/** Returns summary stats + department breakdown (hrApi.getAttendance) */
export const useSupAttendanceSummary = () =>
  useQuery({
    queryKey: [...qk.sup.attendance(), 'summary'] as const,
    queryFn: () => hrApi.getAttendance().then((r) => r.data),
  });

/** Returns paginated attendance records (hrApi.getAttendanceRecords) */
export const useSupAttendance = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sup.attendance(params),
    queryFn: () => hrApi.getAttendanceRecords(params).then((r) => r.data),
  });

export const useSupShifts = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sup.shifts(params),
    queryFn: () => hrApi.getShifts(params).then((r) => r.data),
  });

export const useSupApprovals = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sup.approvals(params),
    queryFn: () => hrApi.getApprovals(params).then((r) => r.data),
  });
