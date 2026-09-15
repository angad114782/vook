import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import HRSidebar from './HRSidebar';
import { HelpCircle } from 'lucide-react';
import { ErrorBoundary } from '../ErrorBoundary';
import GlobalSearch from '../search/GlobalSearch';
import NotificationBell from '../notifications/NotificationBell';
import { SidebarMobileTrigger } from './RoleSidebar';

function HRTopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const { user } = useAuthStore();
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();

  return (
    <div className="app-topbar" style={{ height: '60px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '16px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div className="app-topbar__leading"><SidebarMobileTrigger onClick={onOpenNavigation} /><GlobalSearch /></div>

      <div className="app-topbar__actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span className="app-topbar__context" style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{user?.company?.name ?? 'Company'}{user?.company?.companyCode ? ` (${user.company.companyCode})` : ''}</span>
        <span className="app-topbar__context" style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{month}, {year}</span>
        <button className="app-topbar__action" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><HelpCircle size={18} /></button>
        <NotificationBell />
        <div className="app-topbar__divider" style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />
        <div className="app-topbar__profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="app-topbar__profile-copy">
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>{user?.name ?? 'HR User'}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>Human Resource</p>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0d4a47' }}>
            {user ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : 'HR'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HRLayout() {
  const { user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  if (!user || user.role !== 'HR') return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <HRSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="app-layout-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <HRTopBar onOpenNavigation={() => setMobileNavOpen(true)} />
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
