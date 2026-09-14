import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import EmployeeSidebar from './EmployeeSidebar';
import { ErrorBoundary } from '../ErrorBoundary';
import GlobalSearch from '../search/GlobalSearch';
import NotificationBell from '../notifications/NotificationBell';

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'E').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'Employee').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function EmployeeLayout() {
  const { user } = useAuthStore();
  if (!user || !['EMPLOYEE', 'SUPER_ADMIN'].includes(user.role)) return <Navigate to="/login" replace />;

  const av = getAv(user.name ?? 'E');

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <EmployeeSidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TopBar */}
        <div style={{ height: '56px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px', flexShrink: 0 }}>
          <GlobalSearch />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{user.role === 'SUPER_ADMIN' ? 'All Companies' : `${user.company?.name ?? 'Company'}${user.company?.companyCode ? ` (${user.company.companyCode})` : ''}`}</span>
          <NotificationBell />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{user.name}</p>
              <p style={{ fontSize: '10px', color: '#94a3b8' }}>Employee</p>
            </div>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '12px' }}>{initials(user.name ?? 'E')}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
