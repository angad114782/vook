import { Activity, BarChart2, Blocks, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, CheckSquare, CreditCard, FileText, FolderOpen, LayoutDashboard, LifeBuoy, Receipt, Shield, ShieldCheck, UserCircle, UserCog, Users, Workflow } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Work', entries: [
    { key: 'users', label: 'Users', Icon: Users, children: [
      { to: '/company-admin/departments', label: 'Departments', Icon: Building2 },
      { to: '/company-admin/designations', label: 'Designations', Icon: BriefcaseBusiness },
      { to: '/company-admin/workforce', label: 'Employees', Icon: Users },
    ] },
    { key: 'time-attendance', label: 'Time & attendance', Icon: CalendarCheck, children: [
      { to: '/company-admin/attendance', label: 'Attendance', Icon: CalendarCheck },
      { to: '/company-admin/shifts', label: 'Shift management', Icon: CalendarDays },
      { to: '/company-admin/calendar', label: 'Holiday calendar', Icon: CalendarDays },
    ] },
    { to: '/company-admin/leaves', label: 'Leave management', Icon: CalendarDays },
    { to: '/company-admin/approvals', label: 'Approvals', Icon: CheckSquare },
    { key: 'payroll', label: 'Payroll', Icon: CreditCard, children: [
      { to: '/company-admin/payroll/overview', label: 'Overview', Icon: LayoutDashboard },
      { to: '/company-admin/payroll/run', label: 'Run payroll', Icon: CreditCard },
      { to: '/company-admin/payroll/salary-structure', label: 'Salary structures', Icon: Receipt },
      { to: '/company-admin/payroll/payslips', label: 'Payslips', Icon: FileText },
      { to: '/company-admin/payroll/compliance', label: 'Compliance', Icon: ShieldCheck },
      { to: '/company-admin/payroll/reports', label: 'Payroll reports', Icon: BarChart2 },
    ] },
    { to: '/company-admin/expenses', label: 'Expenses', Icon: Receipt },
    { to: '/company-admin/documents', label: 'Documents', Icon: FolderOpen },
    { to: '/company-admin/reports', label: 'Reports', Icon: BarChart2 },
  ] },
  { label: 'Administration', entries: [
    { key: 'access-control', label: 'Access control', Icon: Shield, children: [
      { to: '/company-admin/users', label: 'Users & access', Icon: UserCog },
      { to: '/company-admin/settings/roles', label: 'Roles & scopes', Icon: Shield },
    ] },
    { to: '/company-admin/settings/workflows', label: 'Workflows', Icon: Workflow },
    { to: '/company-admin/activity', label: 'Activity log', Icon: Activity },
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
