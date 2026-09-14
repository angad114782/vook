import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import GlobalSearch from '../search/GlobalSearch';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import NotificationBell from '../notifications/NotificationBell';

export default function TopBar() {
  const { user } = useAuthStore();
  const { refresh } = useNotificationCenter();

  return (
    <header style={header}>
      <GlobalSearch />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => void refresh()} style={icon} aria-label="Refresh notifications">
          <RefreshCw size={15} />
        </button>
        <NotificationBell supportPath="/support" />
        <div style={profile}>
          <div style={avatar}>{user?.name?.charAt(0) ?? 'A'}</div>
          <div>
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
const avatar: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#15803d', fontWeight: 700, fontSize: 12 };
const profileName: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 13, fontWeight: 600 };
const profileRole: React.CSSProperties = { margin: '2px 0 0', color: '#94a3b8', fontSize: 11 };
