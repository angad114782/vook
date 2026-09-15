import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '../../api/companies';
import { supportApi } from '../../api/support';

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
