import type { AppNotification } from '../api/notifications';

export type NotificationGroup = {
  key: string;
  latest: AppNotification;
  count: number;
  ids: string[];
};

export function groupNotifications(items: AppNotification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const item of items) {
    const key = item.groupKey ?? (item.entityType && item.entityId ? `${item.entityType}:${item.entityId}` : `notification:${item.id}`);
    const existing = groups.get(key);
    if (existing) { existing.count += 1; existing.ids.push(item.id); }
    else groups.set(key, { key, latest: item, count: 1, ids: [item.id] });
  }
  return [...groups.values()].sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime());
}
