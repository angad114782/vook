import { LayoutDashboard, Settings, UserCircle } from 'lucide-react';
import RoleSidebar from './RoleSidebar';
import { assignableRoleGroups } from './assignableRoleNavigation';

const groups = assignableRoleGroups('/finance');

interface FinanceSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function FinanceSidebar(props: FinanceSidebarProps) {
  return <RoleSidebar {...props} portalKey="finance" roleLabel="Finance" workspaceLabel="Finance workspace" dashboard={{ to: '/finance/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/finance/profile', label: 'Profile', Icon: UserCircle }, { to: '/finance/settings', label: 'Finance settings', Icon: Settings }]} />;
}
