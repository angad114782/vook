import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationsApi, type AppNotification } from '../api/notifications';
import { useSocket } from './useSocket';
import { groupNotifications } from '../utils/notificationGroups';

/**
 * Shared notification hook.
 * Use this in TopBar, NotificationBell, or any other consumer.
 * The shared socket from SocketContext is reused — no extra connections.
 */
export function useNotifications(activeTicketIdRef?: React.RefObject<string | null>) {
  const socket = useSocket();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const internalRef = useRef<string | null>(null);
  const ticketRef = activeTicketIdRef ?? internalRef;

  const isCurrentTicket = useCallback(
    (n: AppNotification) =>
      n.entityType === 'SupportTicket' &&
      Boolean(ticketRef.current && n.entityId === ticketRef.current),
    [ticketRef],
  );

  const load = useCallback(() => {
    void notificationsApi.list().then(({ data }) => {
      const items = data.items ?? data.notifications ?? [];
      const unreadCount = data.unreadCount ?? data.unread ?? 0;
      // Auto-mark notifications for the currently open ticket as read
      const active = items.filter(isCurrentTicket);
      if (active.length) void notificationsApi.markManyRead(active.map((n) => n.id));
      setItems(items.filter((n) => !isCurrentTicket(n)));
      setUnread(Math.max(0, unreadCount - active.length));
    }).catch(() => undefined);
  }, [isCurrentTicket]);

  // Initial fetch
  useEffect(() => { load(); }, [load]);

  // Re-sync persisted notifications after a Socket.IO reconnect.
  useEffect(() => {
    const onReconnect = () => { load(); };
    window.addEventListener('socket:reconnect', onReconnect);
    return () => window.removeEventListener('socket:reconnect', onReconnect);
  }, [load]);

  // Keep the active-ticket filter synchronized with the support modal.
  useEffect(() => {
    const onOpened = (event: Event) => {
      const ticketId = (event as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (!ticketId) return;
      ticketRef.current = ticketId;
      load();
    };
    const onClosed = (event: Event) => {
      const ticketId = (event as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (ticketId && ticketRef.current !== ticketId) return;
      ticketRef.current = null;
      load();
    };
    window.addEventListener('support-ticket-opened', onOpened);
    window.addEventListener('support-ticket-closed', onClosed);
    return () => {
      window.removeEventListener('support-ticket-opened', onOpened);
      window.removeEventListener('support-ticket-closed', onClosed);
    };
  }, [load, ticketRef]);

  // Socket listener — reuse shared socket, never create a new one
  useEffect(() => {
    if (!socket) return;
    const handler = (notification: AppNotification) => {
      // Trigger delivery receipt for support messages
      if (notification.type === 'SUPPORT_MESSAGE' && notification.entityId && notification.commentId) {
        socket.emit('support:delivered', {
          ticketId: notification.entityId,
          commentId: notification.commentId,
        });
      }
      // If the notification is for the currently open ticket, auto-mark read and suppress
      if (isCurrentTicket(notification)) {
        void notificationsApi.markManyRead([notification.id]);
        return;
      }
      if (notification.readAt) return;
      setItems((prev) =>
        prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev],
      );
      setUnread((c) => c + 1);
    };
    socket.on('notification:created', handler);
    return () => { socket.off('notification:created', handler); };
  }, [socket, isCurrentTicket]);

  const groups = useMemo(() => groupNotifications(items), [items]);

  const markGroupRead = useCallback(
    async (ids: string[], count: number) => {
      setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
      setUnread((c) => Math.max(0, c - count));
      try {
        await notificationsApi.markManyRead(ids);
      } catch {
        load(); // rollback on failure
      }
    },
    [load],
  );

  /** Call this when a ticket is opened to suppress its notifications */
  const setActiveTicket = useCallback((ticketId: string | null) => {
    ticketRef.current = ticketId;
    load();
  }, [load, ticketRef]);

  return { items, unread, groups, load, markGroupRead, setActiveTicket };
}
