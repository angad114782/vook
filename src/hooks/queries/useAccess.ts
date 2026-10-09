import { useQuery } from '@tanstack/react-query';
import { accessApi } from '../../api/access';
import { useAuthStore } from '../../store/authStore';

// Random per-tab offset so thousands of tabs never poll in the same second.
const ACCESS_POLL_MS = 60_000 + Math.floor(Math.random() * 20_000);

export const useAccess = () => {
  const role = useAuthStore((s) => s.user?.role);
  const query = useQuery({
    queryKey: ['auth', 'access', role],
    queryFn: () => accessApi.get().then((r) => r.data),
    enabled: !!role,
    staleTime: 30_000,
    refetchInterval: ACCESS_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const permissions = query.data?.permissions ?? [];
  const modules = query.data?.modules ?? [];
  return {
    ...query,
    can: (permission: string) => permissions.includes('*') || permissions.includes(permission),
    moduleEnabled: (name: string) => modules.some((m) => m.name === name && m.isEnabled),
    denialReason: (permission?: string, module?: string) => {
      const subscription = query.data?.subscription;
      if (subscription && ['PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(subscription.state)) return 'SUBSCRIPTION';
      if (module && !modules.some((item) => item.name === module && item.isEnabled)) return 'ENTITLEMENT';
      if (permission && !permissions.includes('*') && !permissions.includes(permission)) return 'PERMISSION';
      return null;
    },
  };
};
