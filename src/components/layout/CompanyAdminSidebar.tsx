import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart2, Blocks, Building2, CalendarCheck, CheckSquare, CreditCard, Fingerprint, GitBranch, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Settings, Shield, UserCog, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAccess } from '../../hooks/queries/useAccess';
import { routeVisible } from '../../config/routeAccess';

type Item = { to: string; label: string; Icon: any; permission?: string; module?: string; recovery?: boolean };
const groups: Array<{ label: string; items: Item[] }> = [
  { label: 'Overview', items: [
    { to: '/company-admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard, permission: 'DASHBOARD.VIEW', module: 'Dashboard' },
    { to: '/company-admin/onboarding', label: 'Setup checklist', Icon: CheckSquare },
  ] },
  { label: 'Workforce', items: [
    { to: '/company-admin/workforce', label: 'Employees', Icon: Users, permission: 'EMPLOYEE_MANAGEMENT.VIEW', module: 'Employee Management' },
    { to: '/company-admin/attendance', label: 'Attendance', Icon: CalendarCheck, permission: 'ATTENDANCE.VIEW', module: 'Attendance' },
    { to: '/company-admin/departments', label: 'Organization', Icon: Building2, permission: 'ORGANIZATION.VIEW', module: 'Organization' },
    { to: '/company-admin/approvals', label: 'Approvals', Icon: CheckSquare, permission: 'APPROVALS.VIEW', module: 'Approvals' },
    { to: '/company-admin/payroll/overview', label: 'Payroll', Icon: CreditCard, permission: 'PAYROLL.VIEW', module: 'Payroll' },
    { to: '/company-admin/reports', label: 'Reports', Icon: BarChart2, permission: 'REPORTS_ANALYTICS.VIEW', module: 'Reports & Analytics' },
    { to: '/company-admin/attendance-integrations', label: 'Attendance devices', Icon: Fingerprint, permission: 'ATTENDANCE_INTEGRATIONS.VIEW', module: 'Attendance Integrations' },
  ] },
  { label: 'Administration', items: [
    { to: '/company-admin/users', label: 'Users & access', Icon: UserCog, permission: 'EMPLOYEE_MANAGEMENT.VIEW', module: 'Employee Management' },
    { to: '/company-admin/settings/roles', label: 'Roles & scopes', Icon: Shield, permission: 'ROLES_PERMISSIONS.VIEW', module: 'Roles & Permissions' },
    { to: '/company-admin/settings/workflows', label: 'Workflows', Icon: GitBranch, permission: 'APPROVALS.CONFIGURE', module: 'Approvals' },
    { to: '/company-admin/activity', label: 'Activity', Icon: Activity },
    { to: '/company-admin/settings/company', label: 'Settings', Icon: Settings },
  ] },
  { label: 'Plan & help', items: [
    { to: '/company-admin/modules', label: 'Plan and modules', Icon: Blocks },
    { to: '/company-admin/plan', label: 'Subscription & billing', Icon: CreditCard, recovery: true },
    { to: '/company-admin/account-security', label: 'Account & security', Icon: KeyRound, recovery: true },
    { to: '/company-admin/support', label: 'Support', Icon: LifeBuoy, recovery: true },
  ] },
];

export default function CompanyAdminSidebar() {
  const navigate = useNavigate(); const location = useLocation(); const { logout } = useAuthStore(); const access = useAccess();
  const toWithContext = (path: string) => location.search.includes('companyId=') ? { pathname: path, search: location.search } : path;
  const visible = (item: Item) => routeVisible(access, item.to);
  return <aside className="ca-sidebar"><div className="sidebar-brand"><div>V</div><span><strong>VOOK</strong><small>Company workspace</small></span></div><nav>{groups.map((group) => {
    const items = group.items.filter(visible); if (!items.length) return null;
    return <section key={group.label}><p>{group.label}</p>{items.map(({ to, label, Icon }) => <NavLink key={to} to={toWithContext(to)} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon size={16} /><span>{label}</span></NavLink>)}</section>;
  })}</nav><div className="sidebar-user"><button onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Sign out</button></div></aside>;
}
