import CompanyAdminSidebar from './CompanyAdminSidebar';
import AppShell from './AppShell';

export default function CompanyAdminLayout() {
  return <AppShell Sidebar={CompanyAdminSidebar} roles={['COMPANY_ADMIN', 'SUPER_ADMIN']} roleLabel="Company Admin" profilePath="/company-admin/profile" supportPath="/company-admin/support" inboxPath="/company-admin/notifications" />;
}
