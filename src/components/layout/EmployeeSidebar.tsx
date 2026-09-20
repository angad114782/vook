import { LayoutDashboard, Settings, UserCircle } from 'lucide-react';
import RoleSidebar from './RoleSidebar';
import { assignableRoleGroups } from './assignableRoleNavigation';

const groups = assignableRoleGroups('/employee');

interface EmployeeSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function EmployeeSidebar(props: EmployeeSidebarProps) {
  return <RoleSidebar {...props} portalKey="employee" roleLabel="Employee" workspaceLabel="My workspace" dashboard={{ to: '/employee/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/employee/profile', label: 'Profile', Icon: UserCircle }, { to: '/employee/settings', label: 'My settings', Icon: Settings }]} />;
}
