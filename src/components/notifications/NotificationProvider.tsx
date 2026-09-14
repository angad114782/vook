import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type AppNotification, type NotificationListResponse } from '../../api/notifications';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { groupNotifications, type NotificationGroup } from '../../utils/notificationGroups';
import { NotificationCenterContext } from './notificationContext';

const notificationQueryKey = ['notifications', 'unread'] as const;
type ReadReceiptAck = { ok: true } | { ok: false; code: string; message: string };
const supportTicketStatuses = new Set(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

function normalize(data: NotificationListResponse): NotificationListResponse {
  return { ...data, items: data.items ?? data.notifications ?? [], unreadCount: data.unreadCount ?? data.unread ?? 0 };
}

function publishSupportStatusUpdate(notification: Pick<AppNotification, 'eventType' | 'entityType' | 'entityId' | 'metadata'>): void {
  const status = notification.metadata?.status;
  if (
    notification.eventType !== 'support.ticket.status'
    || notification.entityType !== 'SupportTicket'
    || !notification.entityId
    || typeof status !== 'string'
    || !supportTicketStatuses.has(status)
  ) return;
  window.dispatchEvent(new CustomEvent('support-ticket-status-observed', {
    detail: { ticketId: notification.entityId, status },
  }));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const activeEntityRef = useRef<{ type: string; id: string } | null>(null);
  const pendingReadTicketIds = useRef(new Set<string>());
  const inFlightReadTicketIds = useRef(new Set<string>());

  const query = useQuery({
    queryKey: notificationQueryKey,
    queryFn: async () => normalize((await notificationsApi.list({ status: 'unread', limit: 50 })).data),
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: notificationQueryKey }); }, [queryClient]);

  const markIdsRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await notificationsApi.markManyRead(ids);
  }, []);

  const flushSupportReadReceipts = useCallback(() => {
    if (!socket?.connected) return;
    for (const ticketId of pendingReadTicketIds.current) {
      if (inFlightReadTicketIds.current.has(ticketId)) continue;
      inFlightReadTicketIds.current.add(ticketId);
      socket.timeout(3_000).emit('support:read', { ticketId }, (error: Error | null, result?: ReadReceiptAck) => {
        inFlightReadTicketIds.current.delete(ticketId);
        if (!error && result?.ok) pendingReadTicketIds.current.delete(ticketId);
        // Explicit denials are terminal; transport failures stay queued for reconnect.
        else if (!error && result && !result.ok) pendingReadTicketIds.current.delete(ticketId);
      });
    }
  }, [socket]);

  // One receipt per ticket: deduplicate grouped notifications and retain
  // unacknowledged receipts until Socket.IO reconnects.
  const publishSupportReadReceipts = useCallback((notifications: readonly Pick<AppNotification, 'entityType' | 'entityId'>[]) => {
    for (const notification of notifications) {
      if (notification.entityType === 'SupportTicket' && notification.entityId) {
        pendingReadTicketIds.current.add(notification.entityId);
      }
    }
    flushSupportReadReceipts();
  }, [flushSupportReadReceipts]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => flushSupportReadReceipts();
    socket.on('connect', onConnect);
    flushSupportReadReceipts();
    return () => { socket.off('connect', onConnect); };
  }, [socket, flushSupportReadReceipts]);

  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: notificationQueryKey });
      return;
    }
    const onReconnect = () => { void refresh(); };
    const onOpened = (event: Event) => {
      const ticketId = (event as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (!ticketId) return;
      activeEntityRef.current = { type: 'SupportTicket', id: ticketId };
      const data = queryClient.getQueryData<NotificationListResponse>(notificationQueryKey);
      const ids = (data?.items ?? []).filter((item) => item.entityType === 'SupportTicket' && item.entityId === ticketId).map((item) => item.id);
      queryClient.setQueryData<NotificationListResponse>(notificationQueryKey, (current) => current ? {
        ...current,
        items: current.items.filter((item) => !ids.includes(item.id)),
        unreadCount: Math.max(0, current.unreadCount - ids.length),
      } : current);
      void markIdsRead(ids).catch(() => refresh());
    };
    const onClosed = (event: Event) => {
      const ticketId = (event as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (!ticketId || activeEntityRef.current?.id === ticketId) activeEntityRef.current = null;
    };
    window.addEventListener('socket:reconnect', onReconnect);
    window.addEventListener('support-ticket-opened', onOpened);
    window.addEventListener('support-ticket-closed', onClosed);
    return () => {
      window.removeEventListener('socket:reconnect', onReconnect);
      window.removeEventListener('support-ticket-opened', onOpened);
      window.removeEventListener('support-ticket-closed', onClosed);
    };
  }, [user, markIdsRead, queryClient, refresh]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = (notification: AppNotification) => {
      if (notification.entityType && notification.entityId && activeEntityRef.current?.type === notification.entityType && activeEntityRef.current.id === notification.entityId) {
        void notificationsApi.markManyRead([notification.id]);
        return;
      }
      queryClient.setQueryData<NotificationListResponse>(notificationQueryKey, (current) => {
        const base = current ?? { items: [], nextCursor: null, unreadCount: 0 };
        if (base.items.some((item) => item.id === notification.id)) return base;
        return { ...base, items: [notification, ...base.items], unreadCount: base.unreadCount + 1 };
      });
    };
    socket.on('notification:created', onCreated);
    return () => { socket.off('notification:created', onCreated); };
  }, [socket, queryClient]);

  const data = normalize(query.data ?? { items: [], nextCursor: null, unreadCount: 0 });
  const groups = useMemo(() => groupNotifications(data.items), [data.items]);

  const markGroupRead = async (group: NotificationGroup) => {
    queryClient.setQueryData<NotificationListResponse>(notificationQueryKey, (current) => current ? {
      ...current,
      items: current.items.filter((item) => !group.ids.includes(item.id)),
      unreadCount: Math.max(0, current.unreadCount - group.ids.length),
    } : current);
    try {
      await markIdsRead(group.ids);
      publishSupportReadReceipts([group.latest]);
      publishSupportStatusUpdate(group.latest);
    } catch {
      await refresh();
    }
  };

  const markAllRead = async () => {
    const notifications = queryClient.getQueryData<NotificationListResponse>(notificationQueryKey)?.items ?? [];
    queryClient.setQueryData<NotificationListResponse>(notificationQueryKey, (current) => current ? { ...current, items: [], unreadCount: 0 } : current);
    try {
      await notificationsApi.markAllRead();
      publishSupportReadReceipts(notifications);
      notifications.forEach(publishSupportStatusUpdate);
    } catch {
      await refresh();
    }
  };

  return (
    <NotificationCenterContext.Provider value={{ items: data.items, groups, unread: data.unreadCount, loading: query.isLoading, refresh, markGroupRead, markAllRead }}>
      {children}
    </NotificationCenterContext.Provider>
  );
}
