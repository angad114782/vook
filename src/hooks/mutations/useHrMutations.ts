import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr';

export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      const key = globalThis.crypto?.randomUUID?.() ?? `employee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return hrApi.createEmployee(data, key).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      qc.invalidateQueries({ queryKey: ['hr', 'departments'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['ca', 'departments'] });
      qc.invalidateQueries({ queryKey: ['ca', 'users'] });
    },
  });
};

export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) =>
      hrApi.updateEmployee(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      qc.invalidateQueries({ queryKey: ['hr', 'departments'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    },
  });
};

export const useCreateAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; status: string; notes?: string }) =>
      hrApi.createAttendanceRecord(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      qc.invalidateQueries({ queryKey: ['mgr', 'attendance'] });
      qc.invalidateQueries({ queryKey: ['sup', 'attendance'] });
      qc.invalidateQueries({ queryKey: ['finance', 'attendance'] });
    },
  });
};

export const useUpdateLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      hrApi.updateLeave(id, status).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['emp', 'leaves'] });
    },
  });
};

export const useLeaveAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, version, reason }: { id: string; action: 'approve' | 'reject' | 'cancel'; version?: number; reason?: string }) =>
      hrApi.leaveAction(id, { action, version, reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['emp', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    },
  });
};

export const useUpdateApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      hrApi.updateApproval(id, status).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['mgr', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['sup', 'approvals'] });
    },
  });
};

export const useRunPayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { month: number; year: number; employeeIds?: string[] }) =>
      hrApi.runPayroll(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['hr', 'salary'] });
      qc.invalidateQueries({ queryKey: ['finance', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['finance', 'salary'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['emp', 'payslips'] });
    },
  });
};

export const useCreateDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { file: File; name: string; category: string; version: string; visibility: string }) => {
      const { file, ...meta } = payload;
      const { data: upload } = await hrApi.uploadDocumentFile(file);
      return hrApi.createDocument({ ...meta, fileUrl: upload.fileUrl, fileSize: upload.fileSize }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'documents'] });
      qc.invalidateQueries({ queryKey: ['emp', 'documents'] });
    },
  });
};

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.deleteDocument(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'documents'] });
      qc.invalidateQueries({ queryKey: ['emp', 'documents'] });
    },
  });
};

export const useCreateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employeeId: string; date: string; shiftName: 'Morning' | 'Evening' | 'Night'; startTime?: string; endTime?: string; notes?: string }) =>
      hrApi.createShift(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'shifts'] });
      qc.invalidateQueries({ queryKey: ['sup', 'shifts'] });
    },
  });
};

export const useUpdateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { shiftName?: 'Morning' | 'Evening' | 'Night'; startTime?: string; endTime?: string; status?: 'Assigned' | 'Completed' | 'Cancelled'; notes?: string } }) =>
      hrApi.updateShift(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'shifts'] });
      qc.invalidateQueries({ queryKey: ['sup', 'shifts'] });
    },
  });
};
