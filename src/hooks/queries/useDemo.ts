import { useMutation, useQuery } from '@tanstack/react-query';
import { demoApi } from '../../api/demo';
import { isMockMode } from '../../config/runtime';

export function useDemoAccounts() {
  return useQuery({
    queryKey: ['demo', 'accounts'],
    queryFn: demoApi.accounts,
    enabled: isMockMode,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useResetDemoData() {
  return useMutation({ mutationFn: demoApi.reset });
}
