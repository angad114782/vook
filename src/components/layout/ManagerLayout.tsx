import AppShell from './AppShell';
import ManagerSidebar from './ManagerSidebar';

export default function ManagerLayout() {
  return <AppShell Sidebar={ManagerSidebar} roles={['MANAGER', 'SUPER_ADMIN']} roleLabel="Manager" profilePath="/manager/profile" inboxPath="/manager/notifications" />;
}
