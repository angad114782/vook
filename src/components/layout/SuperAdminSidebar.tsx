import { Activity, Bell, Building2, CreditCard, Headphones, KeyRound, LayoutDashboard, ReceiptIndianRupee, Settings, ShieldCheck, Users } from 'lucide-react';
import RoleSidebar, { type RoleNavGroup } from './RoleSidebar';

const groups: RoleNavGroup[] = [
  { label: 'Customers', entries: [
    { to: '/companies', label: 'Organizations', Icon: Building2 },
    { key: 'commercial', label: 'Commercial', Icon: CreditCard, children: [
      { to: '/subscriptions', label: 'Plans & subscriptions', Icon: CreditCard },
      { to: '/payments', label: 'Billing & payments', Icon: ReceiptIndianRupee },
    ] },
  ] },
  { label: 'Operations', entries: [
    { to: '/platform-employees', label: 'Employees', Icon: Users },
    { to: '/notifications-admin', label: 'Announcements', Icon: Bell },
    { to: '/activity', label: 'Activity log', Icon: Activity },
  ] },
  { label: 'Platform', entries: [
    { key: 'platform-controls', label: 'Platform controls', Icon: ShieldCheck, children: [
      { to: '/audit', label: 'Audit & security', Icon: ShieldCheck },
      { to: '/integrations', label: 'Integrations', Icon: KeyRound },
      { to: '/settings', label: 'System settings', Icon: Settings },
    ] },
  ] },
];

interface SuperAdminSidebarProps { mobileOpen?: boolean; onMobileClose?: () => void }

export default function SuperAdminSidebar(props: SuperAdminSidebarProps) {
  return <RoleSidebar {...props} portalKey="super-admin" roleLabel="Super Admin" workspaceLabel="Control plane" dashboard={{ to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }} groups={groups} footerLinks={[{ to: '/support', label: 'Support', Icon: Headphones }]} accountLink={{ to: '/security', label: 'Account security', Icon: KeyRound }} />;
}
