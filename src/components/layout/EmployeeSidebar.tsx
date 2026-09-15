import { CalendarCheck, FileText, FolderOpen, LayoutDashboard, Plane, Receipt, Settings } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'My work', entries: [
    { to: '/employee/attendance', label: 'Attendance', Icon: CalendarCheck },
    { to: '/employee/leaves', label: 'My leave', Icon: Plane },
  ] },
  { label: 'Pay & records', entries: [
    { to: '/employee/payslips', label: 'Payslips', Icon: FileText },
    { to: '/employee/expenses', label: 'Expenses', Icon: Receipt },
    { to: '/employee/documents', label: 'Documents', Icon: FolderOpen },
  ] },
];

interface EmployeeSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function EmployeeSidebar(props: EmployeeSidebarProps) {
  return <RoleSidebar {...props} portalKey="employee" roleLabel="Employee" workspaceLabel="My workspace" dashboard={{ to: '/employee/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLink={{ to: '/employee/settings', label: 'My settings', Icon: Settings }} />;
}
