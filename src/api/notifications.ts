import api from './axios';
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  eventType?: string;
  category?: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  groupKey?: string;
  action?: { type?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  commentId?: string;
  readAt?: string;
  createdAt: string;
}
export interface NotificationListResponse { items: AppNotification[]; notifications?: AppNotification[]; nextCursor: string | null; unreadCount: number; unread?: number; }
export interface NotificationPreferencesResponse { preferences: Record<string, boolean>; }
export const notificationsApi = {
  list: (params?: { status?: 'unread' | 'all'; cursor?: string; limit?: number }) =>
    api.get<NotificationListResponse>('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markManyRead: (ids: string[]) => api.patch('/notifications/read', { ids }),
  markAllRead: () => api.patch('/notifications/read-all'),
  getPreferences: () => api.get<NotificationPreferencesResponse>('/notifications/preferences'),
  updatePreferences: (preferences: Record<string, boolean>) => api.put<NotificationPreferencesResponse>('/notifications/preferences', { preferences }),
};
