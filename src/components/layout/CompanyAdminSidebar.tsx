import { Activity, BarChart2, Blocks, Building2, CalendarCheck, CalendarDays, CheckSquare, CreditCard, FileText, FolderOpen, GitBranch, LayoutDashboard, LifeBuoy, Receipt, Settings, Shield, ShieldCheck, UserCircle, UserCog, Users } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Work', entries: [
    { key: 'people', label: 'People', Icon: Users, children: [
      { to: '/company-admin/workforce', label: 'Employees', Icon: Users },
      { to: '/company-admin/departments', label: 'Organization', Icon: Building2 },
    ] },
    { key: 'time-attendance', label: 'Time & attendance', Icon: CalendarCheck, children: [
      { to: '/company-admin/attendance', label: 'Attendance', Icon: CalendarCheck },
      { to: '/company-admin/attendance-integrations', label: 'Attendance policy', Icon: ShieldCheck },
      { to: '/company-admin/shifts', label: 'Shift management', Icon: CalendarDays },
    ] },
    { to: '/company-admin/leaves', label: 'Leave management', Icon: CalendarDays },
    { to: '/company-admin/approvals', label: 'Approvals', Icon: CheckSquare },
    { to: '/company-admin/payroll/overview', label: 'Payroll', Icon: CreditCard },
    { to: '/company-admin/payslips', label: 'Payslips', Icon: FileText },
    { to: '/company-admin/expenses', label: 'Expenses', Icon: Receipt },
    { to: '/company-admin/documents', label: 'Documents', Icon: FolderOpen },
    { to: '/company-admin/reports', label: 'Reports', Icon: BarChart2 },
  ] },
  { label: 'Administration', entries: [
    { key: 'access-control', label: 'Access control', Icon: Shield, children: [
      { to: '/company-admin/users', label: 'Users & access', Icon: UserCog },
      { to: '/company-admin/settings/roles', label: 'Roles & scopes', Icon: Shield },
    ] },
    { to: '/company-admin/settings/workflows', label: 'Workflows', Icon: GitBranch },
    { to: '/company-admin/activity', label: 'Activity log', Icon: Activity },
    { to: '/company-admin/settings/company', label: 'Company details', Icon: Settings },
  ] },
  { label: 'Plan', entries: [
    { to: '/company-admin/modules', label: 'Plan and modules', Icon: Blocks },
    { to: '/company-admin/plan', label: 'Subscription & billing', Icon: CreditCard },
  ] },
];

interface CompanyAdminSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function CompanyAdminSidebar(props: CompanyAdminSidebarProps) {
  return <RoleSidebar {...props} portalKey="company-admin" roleLabel="Company Admin" workspaceLabel="Company workspace" preserveSearch dashboard={{ to: '/company-admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} feature={{ to: '/company-admin/onboarding', eyebrow: 'Company checklist', label: 'Finish setup', Icon: CheckSquare }} footerLinks={[{ to: '/company-admin/support', label: 'Support', Icon: LifeBuoy }]} accountLinks={[{ to: '/company-admin/profile', label: 'Profile', Icon: UserCircle }]} />;
}
