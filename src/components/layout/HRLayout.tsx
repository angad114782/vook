import AppShell from './AppShell';
import HRSidebar from './HRSidebar';

export default function HRLayout() {
  return <AppShell Sidebar={HRSidebar} roles={['HR']} roleLabel="Human Resources" profilePath="/hr/profile" inboxPath="/hr/notifications" />;
}
