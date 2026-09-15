import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell, Building2, CalendarDays, Check, CheckCheck, Clock3, FileText,
  Inbox, LoaderCircle, MessageCircle, RefreshCw, Search, ShieldCheck, WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type AppNotification, type NotificationListResponse } from '../api/notifications';
import { useNotificationCenter } from '../hooks/useNotificationCenter';
import { useAuthStore } from '../store/authStore';
import './notificationInbox.css';
import {
  getNotificationCategory, getNotificationCategoryLabel, getNotificationDestination,
  isNotificationUnread, type NotificationCategory, type NotificationRole,
} from '../utils/notificationInbox';

const inboxQueryKey = ['notifications', 'inbox'] as const;
const categoryChoices: Array<{ key: NotificationCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All activity' },
  { key: 'leave', label: 'Leave & requests' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'payroll', label: 'Payroll & payslips' },
  { key: 'documents', label: 'Documents & policies' },
  { key: 'support', label: 'Support' },
  { key: 'company', label: 'Company updates' },
];

const categoryIcons = {
  leave: CalendarDays,
  attendance: Clock3,
  approvals: ShieldCheck,
  payroll: WalletCards,
  documents: FileText,
  support: MessageCircle,
  company: Building2,
  general: Bell,
};

function normalizePage(data: NotificationListResponse): NotificationListResponse & { items: AppNotification[]; nextCursor: string | null } {
  const items = (data.items ?? data.notifications ?? []).map((item) => ({
    ...item,
    isRead: item.isRead ?? Boolean(item.readAt),
  }));
  return { ...data, items, nextCursor: data.nextCursor ?? null };
}

function getDateGroup(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.floor((todayStart - dateStart) / 86_400_000);
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return 'Earlier this week';
  return 'Older';
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function NotificationItem({
  notification,
  busy,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification;
  busy: boolean;
  onOpen: (notification: AppNotification) => void;
  onMarkRead: (notification: AppNotification) => void;
}) {
  const category = getNotificationCategory(notification);
  const Icon = categoryIcons[category];
  const unread = isNotificationUnread(notification);

  return (
    <article className={'notification-item' + (unread ? ' is-unread' : '')}>
      <span className={'notification-item__icon notification-item__icon--' + category} aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
      <button className="notification-item__open" onClick={() => onOpen(notification)}>
        <span className="notification-item__heading">
          <strong>{notification.title}</strong>
          <span className="notification-item__category">{getNotificationCategoryLabel(category)}</span>
        </span>
        <span className="notification-item__message">{notification.message}</span>
        <span className="notification-item__meta"><time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>{unread && <span className="notification-item__new">New</span>}</span>
      </button>
      {unread ? (
        <button
          className="notification-item__read"
          aria-label={'Mark ' + notification.title + ' as read'}
          title="Mark as read"
          disabled={busy}
          onClick={() => onMarkRead(notification)}
        >
          {busy ? <LoaderCircle size={16} className="notification-spin" /> : <Check size={16} />}
        </button>
      ) : <span className="notification-item__read-placeholder" aria-hidden="true"><CheckCheck size={15} /></span>}
    </article>
  );
}

export default function NotificationInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const center = useNotificationCenter();
  const role = useAuthStore((state) => state.user?.role ?? 'EMPLOYEE') as NotificationRole;
  const [status, setStatus] = useState<'all' | 'unread'>('all');
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const query = useInfiniteQuery({
    queryKey: inboxQueryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => normalizePage((await notificationsApi.list({ status: 'all', cursor: pageParam, limit: 50 })).data),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const unique = new Map<string, AppNotification>();
    query.data?.pages.forEach((page) => page.items.forEach((item) => unique.set(item.id, item)));
    return [...unique.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [query.data]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      if (status === 'unread' && !isNotificationUnread(item)) return false;
      if (category !== 'all' && getNotificationCategory(item) !== category) return false;
      return !normalizedSearch || [item.title, item.message, getNotificationCategoryLabel(getNotificationCategory(item))]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [items, status, category, search]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    visibleItems.forEach((item) => {
      const group = getDateGroup(item.createdAt);
      groups.set(group, [...(groups.get(group) ?? []), item]);
    });
    return [...groups.entries()];
  }, [visibleItems]);

  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
    ]);
  };

  const markRead = async (notification: AppNotification) => {
    if (!isNotificationUnread(notification)) return;
    setBusyId(notification.id);
    try {
      await center.markNotificationRead(notification);
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      toast.error('This notification could not be marked as read. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    await markRead(notification);
    navigate(getNotificationDestination(notification, role));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await center.markAllRead();
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Notifications could not be updated. Try again.');
    } finally {
      setMarkingAll(false);
    }
  };

  const clearFilters = () => { setSearch(''); setStatus('all'); setCategory('all'); };

  return (
    <div className="notification-page admin-page">
      <header className="notification-page__header admin-page__header">
        <div>
          <span className="notification-page__eyebrow">WORKSPACE / INBOX</span>
          <h1>Notifications</h1>
          <p>Stay up to date on your people, requests, payroll and workplace activity.</p>
        </div>
        <div className="notification-page__actions">
          <button className="admin-button admin-button--secondary notification-page__refresh" onClick={() => void refresh()} disabled={query.isFetching}>
            <RefreshCw size={15} className={query.isFetching ? 'notification-spin' : ''} /> Refresh
          </button>
          <button className="admin-button" onClick={() => void markAllRead()} disabled={center.unread === 0 || markingAll}>
            {markingAll ? <LoaderCircle size={15} className="notification-spin" /> : <CheckCheck size={15} />}
            Mark all as read
          </button>
        </div>
      </header>

      <section className="notification-summary" aria-live="polite">
        <span className="notification-summary__icon"><Inbox size={20} /></span>
        <div className="notification-summary__copy">
          <strong>{center.unread ? 'You have ' + center.unread + ' unread update' + (center.unread === 1 ? '' : 's') : 'You’re all caught up'}</strong>
          <span>Important updates from across your HR workspace, in one place.</span>
        </div>
        <span className="notification-summary__count"><strong>{center.unread}</strong><small>UNREAD</small></span>
      </section>

      <div className="notification-layout">
        <aside className="notification-categories" aria-label="Notification categories">
          <h2>Categories</h2>
          <div className="notification-categories__list">
            {categoryChoices.map((choice) => {
              const active = category === choice.key;
              const Icon = choice.key === 'all' ? Inbox : categoryIcons[choice.key];
              return (
                <button key={choice.key} className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => setCategory(choice.key)}>
                  <Icon size={16} strokeWidth={1.8} /><span>{choice.label}</span>
                </button>
              );
            })}
          </div>
          <div className="notification-categories__note">
            <ShieldCheck size={16} />
            <p>Notifications are private to your account and company workspace.</p>
          </div>
        </aside>

        <section className="notification-inbox" aria-label="Notification inbox">
          <div className="notification-inbox__toolbar">
            <div className="notification-tabs" role="tablist" aria-label="Filter notifications">
              <button role="tab" aria-selected={status === 'all'} className={status === 'all' ? 'is-active' : ''} onClick={() => setStatus('all')}>All activity</button>
              <button role="tab" aria-selected={status === 'unread'} className={status === 'unread' ? 'is-active' : ''} onClick={() => setStatus('unread')}>Unread <span>{center.unread}</span></button>
            </div>
            <label className="notification-search">
              <Search size={16} aria-hidden="true" />
              <span className="notification-sr-only">Search notifications</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" />
            </label>
          </div>

          {query.isLoading ? (
            <div className="notification-state"><LoaderCircle size={20} className="notification-spin" /><span>Loading your notifications…</span></div>
          ) : query.isError ? (
            <div className="notification-state notification-state--error">
              <Bell size={21} /><strong>We couldn’t load your inbox</strong><span>Check your connection and try again.</span>
              <button className="admin-button admin-button--secondary" onClick={() => void refresh()}>Try again</button>
            </div>
          ) : visibleItems.length ? (
            <div className="notification-list">
              {groupedItems.map(([label, groupItems]) => (
                <section className="notification-list__group" key={label}>
                  <h2>{label}</h2>
                  <div>{groupItems.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      busy={busyId === notification.id}
                      onOpen={(item) => void openNotification(item)}
                      onMarkRead={(item) => void markRead(item)}
                    />
                  ))}</div>
                </section>
              ))}
              {query.hasNextPage && (
                <button className="notification-load-more" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {query.isFetchingNextPage ? <LoaderCircle size={15} className="notification-spin" /> : null}
                  {query.isFetchingNextPage ? 'Loading more…' : 'Load older notifications'}
                </button>
              )}
            </div>
          ) : (
            <div className="notification-state notification-state--empty">
              <span className="notification-state__icon"><CheckCheck size={23} /></span>
              <strong>{search || status === 'unread' || category !== 'all' ? 'No matching notifications' : 'No notifications yet'}</strong>
              <span>{search || status === 'unread' || category !== 'all' ? 'Try a different search or clear your filters.' : 'Updates about leave, attendance, approvals and payroll will appear here.'}</span>
              {(search || status === 'unread' || category !== 'all') && <button className="notification-clear" onClick={clearFilters}>Clear filters</button>}
            </div>
          )}
        </section>
      </div>
      <span className="notification-page__a11y" aria-live="polite">Showing {visibleItems.length} notifications</span>
    </div>
  );
}
