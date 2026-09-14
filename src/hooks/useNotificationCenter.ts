import { useContext } from 'react';
import { NotificationCenterContext, type NotificationCenterValue } from '../components/notifications/notificationContext';

export function useNotificationCenter(): NotificationCenterValue {
  const value = useContext(NotificationCenterContext);
  if (!value) throw new Error('useNotificationCenter must be used inside NotificationProvider');
  return value;
}
