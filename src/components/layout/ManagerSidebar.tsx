import { BarChart2, CheckSquare, Clock, LayoutDashboard, Settings, Users } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Team', entries: [
    { to: '/manager/workforce', label: 'Workforce', Icon: Users },
    { to: '/manager/attendance', label: 'Attendance', Icon: Clock },
  ] },
  { label: 'Decisions', entries: [
    { to: '/manager/approvals', label: 'Approvals', Icon: CheckSquare },
    { to: '/manager/reports', label: 'Reports', Icon: BarChart2 },
  ] },
];

interface ManagerSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function ManagerSidebar(props: ManagerSidebarProps) {
  return <RoleSidebar {...props} portalKey="manager" roleLabel="Manager" workspaceLabel="Team workspace" dashboard={{ to: '/manager/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLink={{ to: '/manager/settings', label: 'Manager settings', Icon: Settings }} />;
}
