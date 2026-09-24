import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import type { PayrollRunAction } from '../../api/finance';
import { qk } from '../../lib/queryKeys';

export const useFinanceRunPayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { month: number; year: number; employeeIds?: string[] }) =>
      financeApi.runPayroll(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.finance.payrollRuns() });
      qc.invalidateQueries({ queryKey: ['finance', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['finance', 'salary'] });
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['hr', 'salary'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['emp', 'payslips'] });
    },
  });
};

export const usePayrollRunAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, version, reason }: { id: string; action: PayrollRunAction; version: number; reason: string }) =>
      financeApi.payrollRunAction(id, action, { version, reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.finance.payrollRuns() });
      qc.invalidateQueries({ queryKey: ['finance', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] });
      qc.invalidateQueries({ queryKey: ['emp', 'payslips'] });
    },
  });
};

export const useFinanceUpdateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      financeApi.updateExpense(id, status).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['emp', 'expenses'] });
    },
  });
};
