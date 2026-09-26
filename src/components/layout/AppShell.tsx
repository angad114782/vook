import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
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
}

export default function AppShell({ Sidebar, roles, roleLabel, profilePath, supportPath, inboxPath }: AppShellProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contextLabel = useMemo(() => user?.role === 'SUPER_ADMIN' ? 'All Companies' : user?.company ? `${user.company.name}${user.company.companyCode ? ` (${user.company.companyCode})` : ''}` : undefined, [user]);
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  if (!user || !roles.includes(user.role)) return <Navigate to="/login" replace />;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
    <div className="app-layout-content">
      <TopBar onOpenNavigation={() => setMobileNavOpen(true)} roleLabel={roleLabel} profilePath={profilePath} contextLabel={contextLabel} supportPath={supportPath} inboxPath={inboxPath} />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="app-shell__main"><div className="app-shell__content"><ErrorBoundary><Outlet /></ErrorBoundary></div></main>
    </div>
  </div>;
}
