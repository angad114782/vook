import AppShell from './AppShell';
import FinanceSidebar from './FinanceSidebar';

export default function FinanceLayout() {
  return <AppShell Sidebar={FinanceSidebar} roles={['FINANCE', 'SUPER_ADMIN']} roleLabel="Finance" profilePath="/finance/profile" inboxPath="/finance/notifications" />;
}
