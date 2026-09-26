import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bell, Check, Info, MessageSquare, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import SubscriptionStatus from '../subscription/SubscriptionStatus';

const visibleNotificationLimit = 6;

export default function NotificationBell({ supportPath, inboxPath }: { supportPath?: string; inboxPath?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { groups, unread, markGroupRead, markAllRead } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const visibleGroups = groups.slice(0, visibleNotificationLimit);
  const workspace = location.pathname.split('/').filter(Boolean)[0];

  useEffect(() => {
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
    focusable[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    panel.addEventListener('keydown', trapFocus);
    return () => panel.removeEventListener('keydown', trapFocus);
  }, [open]);

  const openNotification = async (group: (typeof groups)[number]) => {
    setOpen(false);
    await markGroupRead(group);
    if (supportPath && group.latest.entityType === 'SupportTicket' && group.latest.entityId) {
      navigate(supportPath + '?ticket=' + encodeURIComponent(group.latest.entityId), { state: { notification: group.latest } });
    }
  };

  const clearAll = async () => {
    await markAllRead();
    setOpen(false);
  };

  return (
    <div ref={ref} className="notification-bell" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((current) => !current)}
        className="notification-bell__trigger"
        style={{ ...trigger, ...(open ? triggerActive : {}) }}
        aria-label={unread ? unread + ' unread notifications' : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} strokeWidth={1.9} />
        {unread > 0 && <span style={badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <section ref={panelRef} className="notification-popover" style={panel} role="dialog" aria-label="Notifications">
          <div style={panelHeader}>
            <div>
              <p style={eyebrow}>INBOX</p>
              <h2 style={heading}>Notifications</h2>
            </div>
            {unread > 0 && (
              <button onClick={() => void clearAll()} style={clearButton}>
                <Check size={13} strokeWidth={2.4} /> Mark read
              </button>
            )}
          </div>

          {workspace === 'company-admin' && (
            <SubscriptionStatus onViewPlan={() => { setOpen(false); navigate('/company-admin/plan'); }} />
          )}

          {groups.length ? (
            <>
              <div style={list}>
                {visibleGroups.map((group) => (
                  <button key={group.key} onClick={() => void openNotification(group)} style={row}>
                    <span style={severityIcon(group.latest.severity)}>{iconFor(group.latest)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={title}>{group.latest.title.replace(/^New reply on /, '')}</b>
                      <span style={message}>{group.latest.message}</span>
                      <span style={time}>{formatRelativeTime(group.latest.createdAt)}</span>
                    </span>
                    {group.count > 1 && <strong style={count}>{group.count}</strong>}
                  </button>
                ))}
              </div>
              {groups.length > visibleNotificationLimit && <p style={overflowHint}>Showing the latest {visibleNotificationLimit} conversations</p>}
            </>
          ) : (
            <div style={empty}>
              <span style={emptyIcon}><Check size={15} strokeWidth={2.4} /></span>
              <span>You're all caught up</span>
            </div>
          )}
          <button onClick={() => { setOpen(false); navigate(inboxPath ?? (workspace ? '/' + workspace + '/notifications' : '/notifications')); }} style={viewAllButton}>
            View all notifications <ArrowUpRight size={13} />
          </button>
        </section>
      )}
    </div>
  );
}

function iconFor(notification: { entityType?: string; severity?: string }) {
  if (notification.severity === 'CRITICAL') return <ShieldAlert size={13} />;
  if (notification.severity === 'WARNING') return <TriangleAlert size={13} />;
  if (notification.entityType === 'SupportTicket') return <MessageSquare size={13} />;
  return <Info size={13} />;
}

function formatRelativeTime(value?: string) {
  if (!value) return '';
  const difference = Date.now() - new Date(value).getTime();
  if (difference < 60_000) return 'Just now';
  if (difference < 3_600_000) return Math.floor(difference / 60_000) + 'm ago';
  if (difference < 86_400_000) return Math.floor(difference / 3_600_000) + 'h ago';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function severityIcon(severity?: string): React.CSSProperties {
  const color = severity === 'CRITICAL' ? '#b42318' : severity === 'WARNING' ? '#b54708' : '#0f766e';
  const background = severity === 'CRITICAL' ? '#fef3f2' : severity === 'WARNING' ? '#fffaeb' : '#f0fdfa';
  return { display: 'grid', placeItems: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: 8, color, background };
}

const trigger: React.CSSProperties = {
  position: 'relative', width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', color: '#475569', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s, color .15s',
};
const triggerActive: React.CSSProperties = { borderColor: '#99f6e4', background: '#f0fdfa', color: '#0f766e' };
const badge: React.CSSProperties = {
  position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8,
  background: '#e11d48', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, lineHeight: 1, border: '2px solid #fff',
};
const panel: React.CSSProperties = {
  position: 'absolute', right: 0, top: 40, zIndex: 2000, width: 336, overflow: 'hidden',
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.14)',
};
const panelHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 11px', borderBottom: '1px solid #f1f5f9',
};
const eyebrow: React.CSSProperties = { margin: 0, color: '#94a3b8', fontSize: 9, fontWeight: 800, letterSpacing: '.09em', lineHeight: 1 };
const heading: React.CSSProperties = { margin: '4px 0 0', color: '#0f172a', fontSize: 13, fontWeight: 700, lineHeight: 1.2 };
const clearButton: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, borderRadius: 6, background: '#f0fdfa',
  color: '#0f766e', padding: '5px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700,
};
const list: React.CSSProperties = { maxHeight: 360, overflowY: 'auto' };
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', padding: '10px 14px',
  border: 0, borderBottom: '1px solid #f8fafc', background: '#fff', textAlign: 'left', cursor: 'pointer',
};
const title: React.CSSProperties = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b', fontSize: 11, fontWeight: 700, lineHeight: 1.35 };
const message: React.CSSProperties = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, color: '#64748b', fontSize: 10.5, lineHeight: 1.35 };
const time: React.CSSProperties = { display: 'block', marginTop: 3, color: '#94a3b8', fontSize: 9.5, lineHeight: 1.2 };
const count: React.CSSProperties = { display: 'grid', placeItems: 'center', minWidth: 18, height: 18, borderRadius: 9, color: '#0f766e', background: '#ccfbf1', fontSize: 9, fontWeight: 800 };
const overflowHint: React.CSSProperties = { margin: 0, padding: '8px 14px', background: '#fafafa', color: '#94a3b8', fontSize: 10, textAlign: 'center' };
const empty: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', color: '#64748b', fontSize: 11, fontWeight: 600 };
const emptyIcon: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: '50%', color: '#0f766e', background: '#f0fdfa' };
const viewAllButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 40,
  border: 0, borderTop: '1px solid #eef2f2', background: '#fbfdfd', color: '#0f766e', cursor: 'pointer', fontSize: 10, fontWeight: 800,
};
