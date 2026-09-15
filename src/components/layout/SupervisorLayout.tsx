import { useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown } from 'lucide-react';
import SupervisorSidebar from './SupervisorSidebar';
import { useAuthStore } from '../../store/authStore';
import { ErrorBoundary } from '../ErrorBoundary';
import GlobalSearch from '../search/GlobalSearch';
import NotificationBell from '../notifications/NotificationBell';
import { SidebarMobileTrigger } from './RoleSidebar';

const MONTH = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const initials = (user?.name ?? 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app-topbar" style={{ height: '60px', minHeight: '60px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '16px' }}>
      <div className="app-topbar__leading"><SidebarMobileTrigger onClick={onOpenNavigation} /><GlobalSearch /></div>
      <div className="app-topbar__actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span className="app-topbar__context" style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{user?.company?.name ?? 'Company'}{user?.company?.companyCode ? ` (${user.company.companyCode})` : ''}</span>
      <div className="app-topbar__context" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{MONTH}</span>
          <ChevronDown size={13} color="#94a3b8" />
        </div>
        <NotificationBell />
      <button className="app-topbar__action" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}><RefreshCw size={16} /></button>
      <div className="app-topbar__profile" onClick={() => navigate('/supervisor/settings')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
        <div className="app-topbar__profile-copy" style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{user?.name ?? 'Supervisor'}</p>
            <p style={{ fontSize: '11px', color: '#64748b' }}>Supervisor</p>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#0d7470', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '12px' }}>{initials}</div>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorLayout() {
  const { user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPERVISOR' && user.role !== 'SUPER_ADMIN') return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8fafc' }}>
      <SupervisorSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="app-layout-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar onOpenNavigation={() => setMobileNavOpen(true)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
