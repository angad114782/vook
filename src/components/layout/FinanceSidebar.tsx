import { BarChart2, CreditCard, FileText, Landmark, LayoutDashboard, Receipt, Settings } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Payroll', entries: [{ key: 'payroll', label: 'Payroll operations', Icon: CreditCard, children: [
    { to: '/finance/payroll', label: 'Payroll runs', Icon: CreditCard },
    { to: '/finance/salary-structure', label: 'Salary structure', Icon: Landmark },
    { to: '/finance/payslips', label: 'Payslips', Icon: FileText },
  ] }] },
  { label: 'Finance', entries: [
    { to: '/finance/expenses', label: 'Expenses', Icon: Receipt },
    { to: '/finance/reports', label: 'Reports', Icon: BarChart2 },
  ] },
];

interface FinanceSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function FinanceSidebar(props: FinanceSidebarProps) {
  return <RoleSidebar {...props} portalKey="finance" roleLabel="Finance" workspaceLabel="Finance workspace" dashboard={{ to: '/finance/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} accountLink={{ to: '/finance/settings', label: 'Finance settings', Icon: Settings }} />;
}
