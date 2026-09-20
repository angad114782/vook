import SuperAdminSidebar from './SuperAdminSidebar';
import AppShell from './AppShell';

export default function SuperAdminLayout() {
  return <AppShell Sidebar={SuperAdminSidebar} roles={['SUPER_ADMIN']} roleLabel="Super Admin" profilePath="/profile" supportPath="/support" inboxPath="/notifications" />;
}
