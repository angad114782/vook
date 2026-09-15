import { createContext } from 'react';
import type { AppNotification } from '../../api/notifications';
import type { NotificationGroup } from '../../utils/notificationGroups';

export type NotificationCenterValue = {
  items: AppNotification[];
  groups: NotificationGroup[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markNotificationRead: (notification: AppNotification) => Promise<void>;
  markGroupRead: (group: NotificationGroup) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);
