import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lookupApi, type LookupType } from '../api/lookups';
import type { SelectOption } from '../components/ui/CreatableSelect';

/** One database-backed list as dropdown options, with add and delete. Include `current` so an older saved value still shows. */
export function useLookup(type: LookupType, current?: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['lookup', type], queryFn: () => lookupApi.list(type), staleTime: 60_000 });
  const items = query.data?.items ?? [];
  const options = useMemo<SelectOption[]>(() => {
    const base = items.map((value) => ({ value, label: value }));
    return current && !items.includes(current) ? [{ value: current, label: current }, ...base] : base;
  }, [items, current]);
  const refresh = () => client.invalidateQueries({ queryKey: ['lookup', type] });
  return {
    items, options, loading: query.isLoading, canManage: query.data?.canManage ?? false,
    createOption: async (name: string): Promise<SelectOption> => { const r = await lookupApi.add(type, name); await refresh(); return { value: r.value, label: r.value }; },
    deleteOption: async (value: string) => { await lookupApi.remove(type, value); await refresh(); },
    canDelete: (value: string) => items.includes(value),
  };
}
