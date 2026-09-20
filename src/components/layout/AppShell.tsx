import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ErrorBoundary } from '../ErrorBoundary';
import TopBar from './TopBar';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface AppShellProps {
  Sidebar: ComponentType<SidebarProps>;
  roles: string[];
  roleLabel: string;
  profilePath: string;
  supportPath?: string;
  inboxPath?: string;
  banner?: ReactNode;
}

export default function AppShell({ Sidebar, roles, roleLabel, profilePath, supportPath, inboxPath, banner }: AppShellProps) {
  const { user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contextLabel = useMemo(() => user?.role === 'SUPER_ADMIN' ? 'All Companies' : user?.company ? `${user.company.name}${user.company.companyCode ? ` (${user.company.companyCode})` : ''}` : undefined, [user]);
  if (!user || !roles.includes(user.role)) return <Navigate to="/login" replace />;

  return <div className="app-shell">
    <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
    <div className="app-layout-content">
      <TopBar onOpenNavigation={() => setMobileNavOpen(true)} roleLabel={roleLabel} profilePath={profilePath} contextLabel={contextLabel} supportPath={supportPath} inboxPath={inboxPath} />
      {banner}
      <main className="app-shell__main"><div className="app-shell__content"><ErrorBoundary><Outlet /></ErrorBoundary></div></main>
    </div>
  </div>;
}
