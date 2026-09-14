import { useQuery } from '@tanstack/react-query';
import { companiesApi } from '../../api/companies';
import { subscriptionsApi } from '../../api/subscriptions';
import { activityApi } from '../../api/activity';
import { supportApi } from '../../api/support';
import { modulesApi } from '../../api/modules';
import { qk } from '../../lib/queryKeys';

export const useSaCompanies = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sa.companies(params),
    queryFn: () => companiesApi.getAll(params).then((r) => r.data),
  });

export const useSaPlans = () =>
  useQuery({
    queryKey: qk.sa.plans(),
    queryFn: () => subscriptionsApi.getPlans().then((r) => r.data),
  });

export const useSaSubscriptions = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sa.subscriptions(params),
    queryFn: () => subscriptionsApi.getAll(params).then((r) => r.data),
  });

export const useSaActivity = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sa.activity(params),
    queryFn: () => activityApi.getAll(params).then((r) => r.data),
  });

export const useSaSupport = (params?: Record<string, string>) =>
  useQuery({
    queryKey: qk.sa.support(params),
    queryFn: () => supportApi.getAll(params).then((r) => r.data),
  });

export const useSaModules = () =>
  useQuery({
    queryKey: qk.sa.modules(),
    queryFn: () => modulesApi.getModules().then((r) => r.data),
  });

export const useSaRevenueTrend = () =>
  useQuery({
    queryKey: ['sa', 'revenueTrend'] as const,
    queryFn: () => subscriptionsApi.getRevenueTrend().then((r) => r.data),
  });
