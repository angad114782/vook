import { CalendarDays, CheckSquare, Clock, LayoutDashboard, Settings, UserCircle, Users } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Team operations', entries: [
    { to: '/supervisor/workforce', label: 'Workforce', Icon: Users },
    { to: '/supervisor/attendance', label: 'Attendance', Icon: Clock },
    { to: '/supervisor/shifts', label: 'Shift management', Icon: CalendarDays },
  ] },
  { label: 'Decisions', entries: [{ to: '/supervisor/approvals', label: 'Approvals', Icon: CheckSquare }] },
];

interface SupervisorSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function SupervisorSidebar(props: SupervisorSidebarProps) {
  return <RoleSidebar {...props} portalKey="supervisor" roleLabel="Supervisor" workspaceLabel="Team operations" dashboard={{ to: '/supervisor/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/supervisor/profile', label: 'Profile', Icon: UserCircle }, { to: '/supervisor/settings', label: 'Supervisor settings', Icon: Settings }]} />;
}
