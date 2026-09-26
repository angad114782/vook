import { QueryClient } from '@tanstack/react-query';
import { isMockMode } from '../config/runtime';

const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (!isMockMode) return failureCount < 1;

  const status = (error as { response?: { status?: number } })?.response?.status;
  if (typeof status === 'number' && (status < 500 || status === 501)) return false;
  return failureCount < 3;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: isMockMode,
      refetchOnReconnect: 'always',
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(250 * 2 ** attemptIndex, 1_000),
    },
    mutations: {
      retry: 0,
    },
  },
});
