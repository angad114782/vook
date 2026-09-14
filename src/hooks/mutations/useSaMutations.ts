import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi, type CreateCompanyData } from '../../api/companies';
import { subscriptionsApi, type PlanDraft } from '../../api/subscriptions';
import { supportApi } from '../../api/support';
import { qk } from '../../lib/queryKeys';

export const useCreateCompany = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompanyData) => companiesApi.create(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
    },
  });
};

export const useUpdateCompanySa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCompanyData> }) =>
      companiesApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
    },
  });
};

export const useCreatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: string; price: number; maxUsers: number; features: string[] }) =>
      subscriptionsApi.createPlan(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'plans'] });
    },
  });
};

export const useUpdatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlanDraft> & { draftRevision: number } }) =>
      subscriptionsApi.updatePlan(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'plans'] });
      qc.invalidateQueries({ queryKey: ['sa', 'subscriptions'] });
      qc.invalidateQueries({ queryKey: qk.sa.activity() });
    },
  });
};

export const useAssignPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { companyId: string; planVersionId: string; billingCycle: 'Monthly' | 'Annual'; months: number; reason: string }) =>
      subscriptionsApi.assign(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'subscriptions'] });
      qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
      qc.invalidateQueries({ queryKey: qk.sa.activity() });
    },
  });
};

export const useDeleteCompany = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
    },
  });
};

export const useUpdateTicketStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; priority?: string } }) =>
      supportApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'support'] });
      qc.invalidateQueries({ queryKey: ['sa', 'activity'] });
    },
  });
};
