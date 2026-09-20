import { LayoutDashboard, Settings, UserCircle } from 'lucide-react';
import RoleSidebar from './RoleSidebar';
import { assignableRoleGroups } from './assignableRoleNavigation';

const groups = assignableRoleGroups('/manager');

interface ManagerSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function ManagerSidebar(props: ManagerSidebarProps) {
  return <RoleSidebar {...props} portalKey="manager" roleLabel="Manager" workspaceLabel="Team workspace" dashboard={{ to: '/manager/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/manager/profile', label: 'Profile', Icon: UserCircle }, { to: '/manager/settings', label: 'Manager settings', Icon: Settings }]} />;
}
