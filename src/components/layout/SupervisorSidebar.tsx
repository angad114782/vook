import { LayoutDashboard, Settings, UserCircle } from 'lucide-react';
import RoleSidebar from './RoleSidebar';
import { assignableRoleGroups } from './assignableRoleNavigation';

const groups = assignableRoleGroups('/supervisor');

interface SupervisorSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function SupervisorSidebar(props: SupervisorSidebarProps) {
  return <RoleSidebar {...props} portalKey="supervisor" roleLabel="Supervisor" workspaceLabel="Team operations" dashboard={{ to: '/supervisor/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/supervisor/profile', label: 'Profile', Icon: UserCircle }, { to: '/supervisor/settings', label: 'Supervisor settings', Icon: Settings }]} />;
}
