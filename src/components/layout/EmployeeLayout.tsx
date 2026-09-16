import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import EmployeeSidebar from './EmployeeSidebar';
import { ErrorBoundary } from '../ErrorBoundary';
import GlobalSearch from '../search/GlobalSearch';
import NotificationBell from '../notifications/NotificationBell';
import { SidebarMobileTrigger } from './RoleSidebar';
import UserAvatar from './UserAvatar';

export default function EmployeeLayout() {
  const { user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  if (!user || !['EMPLOYEE', 'SUPER_ADMIN'].includes(user.role)) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <EmployeeSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="app-layout-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TopBar */}
        <div className="app-topbar" style={{ height: '56px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px', flexShrink: 0 }}>
          <div className="app-topbar__leading"><SidebarMobileTrigger onClick={() => setMobileNavOpen(true)} /><GlobalSearch /></div>
          <div className="app-topbar__spacer" style={{ flex: 1 }} />
          <div className="app-topbar__actions">
            <span className="app-topbar__context" style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{user.role === 'SUPER_ADMIN' ? 'All Companies' : `${user.company?.name ?? 'Company'}${user.company?.companyCode ? ` (${user.company.companyCode})` : ''}`}</span>
            <NotificationBell />
            <div className="app-topbar__profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <p className="app-topbar__profile-copy" style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{user.name}</p>
              <p className="app-topbar__profile-copy" style={{ fontSize: '10px', color: '#94a3b8' }}>Employee</p>
            </div>
            <UserAvatar user={user} size={34} style={{ borderRadius: '50%' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
