import { LayoutDashboard, Settings, UserCircle } from 'lucide-react';
import RoleSidebar from './RoleSidebar';
import { assignableRoleGroups } from './assignableRoleNavigation';

const groups = assignableRoleGroups('/hr', { workforce: '/hr/employees' });

interface HRSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function HRSidebar(props: HRSidebarProps) {
  return <RoleSidebar {...props} portalKey="hr" roleLabel="Human Resources" workspaceLabel="People operations" dashboard={{ to: '/hr/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/hr/profile', label: 'Profile', Icon: UserCircle }, { to: '/hr/settings', label: 'HR settings', Icon: Settings }]} />;
}
