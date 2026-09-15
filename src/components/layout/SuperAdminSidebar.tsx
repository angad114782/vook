import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Bell, Building2, CreditCard, Headphones, KeyRound, LayoutDashboard, LogOut, ReceiptIndianRupee, Settings, ShieldCheck, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const sections = [
  { label: 'Control plane', items: [
    { label: 'Dashboard', Icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Organizations', Icon: Building2, to: '/companies' },
    { label: 'Plan & subscriptions', Icon: CreditCard, to: '/subscriptions' },
    { label: 'Billing', Icon: ReceiptIndianRupee, to: '/payments' },
  ] },
  { label: 'Operations', items: [
    { label: 'Employees', Icon: Users, to: '/platform-employees' },
    { label: 'Support', Icon: Headphones, to: '/support' },
    { label: 'Announcements', Icon: Bell, to: '/notifications-admin' },
    { label: 'Activity', Icon: Activity, to: '/activity' },
  ] },
  { label: 'Platform', items: [
    { label: 'Audit & security', Icon: ShieldCheck, to: '/audit' },
    { label: 'Integrations', Icon: KeyRound, to: '/integrations' },
    { label: 'System settings', Icon: Settings, to: '/settings' },
  ] },
];

export default function SuperAdminSidebar() {
  const navigate = useNavigate(); const { user, logout } = useAuthStore();
  return <aside className="sa-sidebar">
    <div className="sidebar-brand"><div>V</div><span><strong>VOOK</strong><small>Control plane</small></span></div>
    <nav>{sections.map((section) => <section key={section.label}><p>{section.label}</p>{section.items.map(({ label, Icon, to }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon size={16} /><span>{label}</span></NavLink>)}</section>)}</nav>
    <div className="sidebar-user"><div><span>{user?.name?.charAt(0) ?? 'A'}</span><p><strong>{user?.name}</strong><small>Super Admin</small></p></div><button onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Sign out</button></div>
  </aside>;
}
