import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, type AttendanceLocation } from '../../api/employee';

export const useUpdateMyProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      employeeApi.updateProfile(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'profile'] });
    },
  });
};

export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (location?: AttendanceLocation) => employeeApi.checkIn(location).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'attendance'] });
    },
  });
};

export const useCheckOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (location?: AttendanceLocation) => employeeApi.checkOut(location).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'attendance'] });
    },
  });
};

export const useRequestRegularization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; requestedCheckIn?: string; requestedCheckOut?: string; reason: string }) =>
      employeeApi.requestRegularization(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'attendance', 'regularizations'] });
      qc.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
};

export const useApplyLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) =>
      employeeApi.applyLeave(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['hr', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    },
  });
};

export const useSubmitExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: string; amount: number; description: string; receiptUrl?: string }) =>
      employeeApi.submitExpense(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    },
  });
};
