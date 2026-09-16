import { CalendarDays, CheckSquare, Clock, DollarSign, FileText, LayoutDashboard, Settings, UserCircle, Users } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'People', entries: [{ to: '/hr/employees', label: 'Employees', Icon: Users }] },
  { label: 'Time & leave', entries: [
    { to: '/hr/attendance', label: 'Attendance', Icon: Clock },
    { to: '/hr/leaves', label: 'Leave management', Icon: CalendarDays },
  ] },
  { label: 'Operations', entries: [
    { to: '/hr/approvals', label: 'Approvals', Icon: CheckSquare },
    { to: '/hr/payroll', label: 'Payroll', Icon: DollarSign },
    { to: '/hr/documents', label: 'Document policies', Icon: FileText },
  ] },
];

interface HRSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function HRSidebar(props: HRSidebarProps) {
  return <RoleSidebar {...props} portalKey="hr" roleLabel="Human Resources" workspaceLabel="People operations" dashboard={{ to: '/hr/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLinks={[{ to: '/hr/profile', label: 'Profile', Icon: UserCircle }, { to: '/hr/settings', label: 'HR settings', Icon: Settings }]} />;
}
