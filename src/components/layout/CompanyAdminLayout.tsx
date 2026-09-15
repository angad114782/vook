import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import CompanyAdminSidebar from './CompanyAdminSidebar';
import { RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '../ErrorBoundary';
import SubscriptionBanner from '../subscription/SubscriptionBanner';
import GlobalSearch from '../search/GlobalSearch';
import NotificationBell from '../notifications/NotificationBell';
import { SidebarMobileTrigger } from './RoleSidebar';

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#0d7470' },
  { bg: '#fdf4ff', color: '#a21caf' }, { bg: '#f0f9ff', color: '#0369a1' },
];
const getAv = (n?: string) => avatarColors[(n ?? 'A').charCodeAt(0) % avatarColors.length]!;
const ini   = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();


export default function CompanyAdminLayout() {
  const { user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  if (!user || !['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return <Navigate to="/login" replace />;

  const av = getAv(user.name ?? 'A');

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <CompanyAdminSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

        <div className="app-layout-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TopBar */}
        <div className="app-topbar" style={{ height: '52px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '10px', flexShrink: 0 }}>
          <div className="app-topbar__leading"><SidebarMobileTrigger onClick={() => setMobileNavOpen(true)} /><GlobalSearch /></div>
          <span className="app-topbar__context" style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
            {user.role === 'SUPER_ADMIN' ? 'All Companies' : `${user.company?.name ?? 'Company'}${user.company?.companyCode ? ` (${user.company.companyCode})` : ''}`}
          </span>
          <div className="app-topbar__spacer" style={{ flex: 1 }} />
          <span className="app-topbar__context" style={{ fontSize: '12px', color: '#64748b' }}>Today {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <button className="app-topbar__action" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}><RefreshCw size={13} /></button>
          <div className="app-topbar__divider" style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />
          <div className="app-topbar__actions">
            <NotificationBell supportPath="/company-admin/support" />
            <div className="app-topbar__profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '11px' }}>{ini(user.name ?? 'A')}</div>
            <div className="app-topbar__profile-copy">
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{user.name}</p>
              <p style={{ fontSize: '10px', color: '#94a3b8' }}>Company Admin</p>
            </div>
            </div>
          </div>
          </div>

        <SubscriptionBanner />

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
