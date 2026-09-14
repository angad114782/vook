import { useQuery } from '@tanstack/react-query';
import { accessApi } from '../../api/access';
import { useAuthStore } from '../../store/authStore';

export const useAccess = () => {
  const role = useAuthStore((s) => s.user?.role);
  const query = useQuery({
    queryKey: ['auth', 'access', role],
    queryFn: () => accessApi.get().then((r) => r.data),
    enabled: !!role,
    staleTime: 30_000,
    refetchInterval: 60_000,
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
