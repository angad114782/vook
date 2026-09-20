import EmployeeSidebar from './EmployeeSidebar';
import AppShell from './AppShell';

export default function EmployeeLayout() {
  return <AppShell Sidebar={EmployeeSidebar} roles={['EMPLOYEE', 'SUPER_ADMIN']} roleLabel="Employee" profilePath="/employee/profile" inboxPath="/employee/notifications" />;
}
