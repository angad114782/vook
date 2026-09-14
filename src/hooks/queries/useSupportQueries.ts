import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { supportApi, type SupportCommentsResponse } from '../../api/support';
import { qk } from '../../lib/queryKeys';

export const useSupportComments = (ticketId?: string, enabled = true) =>
  useInfiniteQuery<
    SupportCommentsResponse,
    Error,
    InfiniteData<SupportCommentsResponse, string | null>,
    ReturnType<typeof qk.support.comments>,
    string | null
  >({
    queryKey: qk.support.comments(ticketId ?? ''),
    queryFn: ({ pageParam }) =>
      supportApi.getComments(ticketId!, {
        limit: 50,
        ...(pageParam ? { before: pageParam } : {}),
      }).then((response) => response.data),
    initialPageParam: null as string | null,
    getPreviousPageParam: (firstPage) => firstPage.hasMore ? firstPage.nextCursor : undefined,
    getNextPageParam: () => undefined,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: Boolean(ticketId) && enabled,
  });
