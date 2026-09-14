import { Outlet, Navigate } from 'react-router-dom';
import SuperAdminSidebar from './SuperAdminSidebar';
import TopBar from './TopBar';
import { useAuthStore } from '../../store/authStore';
import { ErrorBoundary } from '../ErrorBoundary';

export default function SuperAdminLayout() {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPER_ADMIN') return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <SuperAdminSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 28px',
          backgroundColor: '#f8fafc',
        }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
