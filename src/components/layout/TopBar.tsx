import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import GlobalSearch from '../search/GlobalSearch';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import NotificationBell from '../notifications/NotificationBell';
import { SidebarMobileTrigger } from './RoleSidebar';
import UserAvatar from './UserAvatar';

export default function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { user } = useAuthStore();
  const { refresh } = useNotificationCenter();

  return (
    <header className="app-topbar" style={header}>
      <div className="app-topbar__leading">{onOpenNavigation && <SidebarMobileTrigger onClick={onOpenNavigation} />}<GlobalSearch /></div>
      <div className="app-topbar__actions">
        <button className="app-topbar__action" onClick={() => void refresh()} style={icon} aria-label="Refresh notifications">
          <RefreshCw size={15} />
        </button>
        <NotificationBell supportPath="/support" inboxPath="/notifications" />
        <div className="app-topbar__profile" style={profile}>
          <UserAvatar user={user} size={32} style={{ borderRadius: '50%' }} />
          <div className="app-topbar__profile-copy">
            <p style={profileName}>{user?.name}</p>
            <p style={profileRole}>Super Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}

const header: React.CSSProperties = {
  height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex',
  alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0,
};
const icon: React.CSSProperties = {
  width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff',
  cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#64748b',
};
const profile: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid #e2e8f0' };
const profileName: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 13, fontWeight: 600 };
const profileRole: React.CSSProperties = { margin: '2px 0 0', color: '#94a3b8', fontSize: 11 };
