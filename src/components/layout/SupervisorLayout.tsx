import AppShell from './AppShell';
import SupervisorSidebar from './SupervisorSidebar';

export default function SupervisorLayout() {
  return <AppShell Sidebar={SupervisorSidebar} roles={['SUPERVISOR', 'SUPER_ADMIN']} roleLabel="Supervisor" profilePath="/supervisor/profile" inboxPath="/supervisor/notifications" />;
}
