import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/authStore';
import { queryClient } from './lib/queryClient';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './components/notifications/NotificationProvider';

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const NotificationInboxPage = lazy(() => import('./pages/NotificationInboxPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPageV2'));
const RegistrationCompletePage = lazy(() => import('./pages/auth/RegistrationCompletePage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const AcceptInvitationPage = lazy(() => import('./pages/auth/AcceptInvitationPage'));

// Layouts (small, load eagerly via normal import for shell stability)
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import HRLayout from './components/layout/HRLayout';
import ManagerLayout from './components/layout/ManagerLayout';
import CompanyAdminLayout from './components/layout/CompanyAdminLayout';
import EmployeeLayout from './components/layout/EmployeeLayout';
import FinanceLayout from './components/layout/FinanceLayout';
import SupervisorLayout from './components/layout/SupervisorLayout';
import AccessGuard from './components/auth/AccessGuard';
import { useAccess } from './hooks/queries/useAccess';
import { routeVisible } from './config/routeAccess';

// Super Admin pages
const DashboardPage       = lazy(() => import('./pages/super-admin/DashboardPage'));
const CompaniesPage       = lazy(() => import('./pages/super-admin/CompaniesPage'));
const SubscriptionsPage   = lazy(() => import('./pages/super-admin/SubscriptionsPage'));
const ActivityPage        = lazy(() => import('./pages/super-admin/ActivityPage'));
const ModulesPage         = lazy(() => import('./pages/super-admin/ModulesPage'));
const SupportPage         = lazy(() => import('./pages/super-admin/SupportPage'));
const SettingsPage        = lazy(() => import('./pages/super-admin/SettingsPage'));
const PaymentsPage        = lazy(() => import('./pages/super-admin/PaymentsPage'));
const IntegrationsPage    = lazy(() => import('./pages/super-admin/IntegrationsPage'));
const AuditPage           = lazy(() => import('./pages/super-admin/AuditPage'));
const SecurityEnrollmentPage = lazy(() => import('./pages/super-admin/SecurityEnrollmentPage'));
const NotificationsAdminPage = lazy(() => import('./pages/super-admin/NotificationsAdminPage'));
const PlatformEmployeesPage = lazy(() => import('./pages/super-admin/PlatformEmployeeDirectoryPage'));

// Shared tenant module pages. Their current folders are legacy source locations;
// routes below reuse these components for every tenant role.
const HRDashboardPage       = lazy(() => import('./pages/hr/HRDashboardPage'));
const EmployeesPage         = lazy(() => import('./pages/hr/EmployeesPage'));
const AttendancePage        = lazy(() => import('./pages/hr/AttendancePage'));
const LeaveManagementPage   = lazy(() => import('./pages/hr/LeaveManagementPage'));
const ApprovalsPage         = lazy(() => import('./pages/hr/ApprovalsPage'));
const DocumentPoliciesPage  = lazy(() => import('./pages/hr/DocumentPoliciesPage'));
const HRSettingsPage        = lazy(() => import('./pages/hr/HRSettingsPage'));
const HolidayCalendarPage   = lazy(() => import('./pages/hr/HolidayCalendarPage'));
const EmployeeDetailPage    = lazy(() => import('./pages/hr/EmployeeDetailPage'));

// Manager pages
const ManagerDashboardPage  = lazy(() => import('./pages/manager/ManagerDashboardPage'));
const ManagerSettingsPage   = lazy(() => import('./pages/manager/ManagerSettingsPage'));

// Company Admin pages
const CADashboardPage        = lazy(() => import('./pages/company-admin/CADashboardPage'));
const CASalaryStructurePage  = lazy(() => import('./pages/company-admin/payroll/CASalaryStructurePage'));
const CAPayslipsPage         = lazy(() => import('./pages/company-admin/payroll/CAPayslipsPage'));
const CAPayrollReportsPage   = lazy(() => import('./pages/company-admin/payroll/CAPayrollReportsPage'));
const CACompliancePage       = lazy(() => import('./pages/company-admin/payroll/CAComplianceProductionPage'));
const CAUsersPage            = lazy(() => import('./pages/company-admin/CAUsersPage'));
const CADepartmentsPage      = lazy(() => import('./pages/company-admin/CADepartmentsPage'));
const CAActivityPage         = lazy(() => import('./pages/company-admin/CAActivityPage'));
const CAModulesPage          = lazy(() => import('./pages/company-admin/CAModulesPage'));
const CARolesPage            = lazy(() => import('./pages/company-admin/CARolesPage'));
const CAWorkflowsPage        = lazy(() => import('./pages/company-admin/CAWorkflowsPage'));
const CASupportPage          = lazy(() => import('./pages/company-admin/CASupportPage'));
const CAOnboardingPage       = lazy(() => import('./pages/company-admin/CAOnboardingPage'));
const CAPlanPage             = lazy(() => import('./pages/company-admin/CAPlanPage'));
const CALandingPage          = lazy(() => import('./pages/company-admin/CALandingPage'));

// Employee pages
const EmployeeDashboardPage = lazy(() => import('./pages/employee/EmployeeDashboardPage'));
const EmployeeSettingsPage  = lazy(() => import('./pages/employee/EmployeeSettingsPage'));
const EmployeePayslipsPage  = lazy(() => import('./pages/employee/EmployeePayslipsPage'));

// Finance pages
const FinanceDashboardPage = lazy(() => import('./pages/finance/FinanceDashboardPage'));
const FinancePayrollPage   = lazy(() => import('./pages/finance/FinancePayrollPage'));
const PayrollOverviewPage  = lazy(() => import('./pages/finance/PayrollOverviewPage'));
const SalaryStructurePage  = lazy(() => import('./pages/finance/SalaryStructurePage'));
const PayslipsPage         = lazy(() => import('./pages/finance/PayslipsPage'));
const ExpensesPage         = lazy(() => import('./pages/finance/ExpensesPage'));
const FinanceReportsPage   = lazy(() => import('./pages/finance/FinanceReportsPage'));
const FinanceSettingsPage  = lazy(() => import('./pages/finance/FinanceSettingsPage'));

// Supervisor pages
const SupervisorDashboardPage  = lazy(() => import('./pages/supervisor/SupervisorDashboardPage'));
const ShiftManagementPage      = lazy(() => import('./pages/supervisor/ShiftManagementPage'));
const SupervisorSettingsPage   = lazy(() => import('./pages/supervisor/SupervisorSettingsPage'));

function PageSpinner() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#0d7470', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

const guarded = (element: React.ReactElement, permission?: string, module?: string) =>
  <AccessGuard permission={permission} module={module}>{element}</AccessGuard>;

function TenantRoleHome({ portal, workforce = 'workforce' }: { portal: string; workforce?: string }) {
  const access = useAccess();
  if (access.isLoading) return <PageSpinner />;
  const candidates = ['dashboard', workforce, 'attendance', 'shifts', 'leaves', 'approvals', 'payroll', 'payslips', 'expenses', 'documents', 'reports'];
  const firstAvailable = candidates.map((section) => `/${portal}/${section}`).find((path) => routeVisible(access, path));
  return <Navigate to={firstAvailable ?? `/${portal}/profile`} replace />;
}

function RoleRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'HR') return <Navigate to="/hr/dashboard" replace />;
  if (user.role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
  if (user.role === 'SUPERVISOR') return <Navigate to="/supervisor/dashboard" replace />;
  if (user.role === 'FINANCE') return <Navigate to="/finance/dashboard" replace />;
  if (user.role === 'COMPANY_ADMIN') return <Navigate to="/company-admin" replace />;
  if (user.role === 'EMPLOYEE') return <Navigate to="/employee/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <SocketProvider>
    <NotificationProvider>
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/complete" element={<RegistrationCompletePage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

          {/* Super Admin routes */}
          <Route path="/" element={<SuperAdminLayout />}>
            <Route index element={<RoleRedirect />} />
            <Route path="dashboard"     element={<DashboardPage />} />
            <Route path="companies"     element={<CompaniesPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            {/* Legacy URL kept for bookmarks; subscriptions now owns plans and access. */}
            <Route path="plans"         element={<Navigate to="/subscriptions" replace />} />
            <Route path="payments"      element={<PaymentsPage />} />
            <Route path="activity"      element={<ActivityPage />} />
            <Route path="modules"       element={<ModulesPage />} />
            <Route path="support"       element={<SupportPage />} />
            <Route path="settings"      element={<SettingsPage />} />
            <Route path="integrations"  element={<IntegrationsPage />} />
            <Route path="audit"         element={<AuditPage />} />
            <Route path="security"      element={<SecurityEnrollmentPage />} />
            <Route path="platform-employees" element={<PlatformEmployeesPage />} />
            <Route path="notifications-admin" element={<NotificationsAdminPage />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* HR routes */}
          <Route path="/hr" element={<HRLayout />}>
            <Route index element={<TenantRoleHome portal="hr" workforce="employees" />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="dashboard"  element={guarded(<HRDashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="employees"  element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="employees/:id" element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar" element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="attendance" element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="shifts"     element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"     element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="approvals"  element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="payroll"    element={guarded(<PayrollOverviewPage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payslips"   element={guarded(<PayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"   element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="documents"  element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="reports"    element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="settings"   element={<HRSettingsPage />} />
            <Route path="profile"   element={<ProfilePage />} />
          </Route>

          {/* Company Admin routes */}
          <Route path="/company-admin" element={<CompanyAdminLayout />}>
            <Route index element={<CALandingPage />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="dashboard"  element={guarded(<CADashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="onboarding" element={<CAOnboardingPage />} />
            <Route path="plan"       element={<CAPlanPage />} />
            <Route path="attendance" element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="workforce"  element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="workforce/:id" element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar" element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="shifts"     element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"     element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="payroll" element={<Navigate to="/company-admin/payroll/overview" replace />} />
            <Route path="payroll/overview"         element={guarded(<PayrollOverviewPage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payroll/run"              element={guarded(<FinancePayrollPage />, 'PAYROLL.PROCESS', 'Payroll')} />
            <Route path="payroll/salary-structure" element={guarded(<CASalaryStructurePage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payroll/payslips"         element={guarded(<CAPayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="payroll/reports"          element={guarded(<CAPayrollReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="payroll/compliance"       element={guarded(<CACompliancePage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payslips"   element={guarded(<PayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"   element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="documents"  element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="approvals"  element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="reports"    element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="users"      element={guarded(<CAUsersPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="departments" element={guarded(<CADepartmentsPage section="departments" />, 'ORGANIZATION.VIEW', 'Organization')} />
            <Route path="designations" element={guarded(<CADepartmentsPage section="designations" />, 'ORGANIZATION.VIEW', 'Organization')} />
            <Route path="activity"   element={<CAActivityPage />} />
            <Route path="modules"    element={<CAModulesPage />} />
            <Route path="account-security"   element={<Navigate to="/company-admin/profile" replace />} />
            <Route path="settings/roles"     element={<CARolesPage />} />
            <Route path="settings/workflows" element={<CAWorkflowsPage />} />
            <Route path="support" element={<CASupportPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Employee routes */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<TenantRoleHome portal="employee" />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="dashboard"  element={guarded(<EmployeeDashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="workforce"  element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="workforce/:id" element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar" element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="attendance" element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="shifts"     element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"     element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="approvals"  element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="payroll"    element={<Navigate to="/employee/payslips" replace />} />
            <Route path="payslips"   element={guarded(<EmployeePayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"   element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="documents"  element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="reports"    element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="settings"   element={<EmployeeSettingsPage />} />
            <Route path="profile"   element={<ProfilePage />} />
          </Route>

          {/* Finance routes */}
          <Route path="/finance" element={<FinanceLayout />}>
            <Route index element={<TenantRoleHome portal="finance" />} />
            <Route path="notifications"    element={<NotificationInboxPage />} />
            <Route path="dashboard"        element={guarded(<FinanceDashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="workforce"        element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="workforce/:id"    element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar"         element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="attendance"       element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="shifts"           element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"           element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="approvals"        element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="payroll"          element={guarded(<PayrollOverviewPage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payroll/run"      element={guarded(<FinancePayrollPage />, 'PAYROLL.PROCESS', 'Payroll')} />
            <Route path="salary-structure" element={guarded(<SalaryStructurePage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payslips"         element={guarded(<PayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"         element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="reports"          element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="documents"        element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="settings"         element={<FinanceSettingsPage />} />
            <Route path="profile"          element={<ProfilePage />} />
          </Route>

          {/* Manager routes */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<TenantRoleHome portal="manager" />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="dashboard"  element={guarded(<ManagerDashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="workforce"  element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="workforce/:id" element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar" element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="approvals"  element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="attendance" element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="shifts"     element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"     element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="payroll"    element={guarded(<PayrollOverviewPage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payslips"   element={guarded(<PayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"   element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="documents"  element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="reports"    element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="settings"   element={<ManagerSettingsPage />} />
            <Route path="profile"   element={<ProfilePage />} />
          </Route>

          {/* Supervisor routes */}
          <Route path="/supervisor" element={<SupervisorLayout />}>
            <Route index element={<TenantRoleHome portal="supervisor" />} />
            <Route path="notifications" element={<NotificationInboxPage />} />
            <Route path="dashboard"  element={guarded(<SupervisorDashboardPage />, 'DASHBOARD.VIEW', 'Dashboard')} />
            <Route path="workforce"  element={guarded(<EmployeesPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="workforce/:id" element={guarded(<EmployeeDetailPage />, 'EMPLOYEE_MANAGEMENT.VIEW', 'Employee Management')} />
            <Route path="calendar" element={guarded(<HolidayCalendarPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="attendance" element={guarded(<AttendancePage />, 'ATTENDANCE.VIEW', 'Attendance')} />
            <Route path="shifts"     element={guarded(<ShiftManagementPage />, 'SHIFT_MANAGEMENT.VIEW', 'Shift Management')} />
            <Route path="leaves"     element={guarded(<LeaveManagementPage />, 'LEAVE_MANAGEMENT.VIEW', 'Leave Management')} />
            <Route path="approvals"  element={guarded(<ApprovalsPage />, 'APPROVALS.VIEW', 'Approvals')} />
            <Route path="payroll"    element={guarded(<PayrollOverviewPage />, 'PAYROLL.VIEW', 'Payroll')} />
            <Route path="payslips"   element={guarded(<PayslipsPage />, 'PAYSLIPS.VIEW', 'Payslips')} />
            <Route path="expenses"   element={guarded(<ExpensesPage />, 'EXPENSE_MANAGEMENT.VIEW', 'Expense Management')} />
            <Route path="documents"  element={guarded(<DocumentPoliciesPage />, 'DOCUMENTS.VIEW', 'Documents')} />
            <Route path="reports"    element={guarded(<FinanceReportsPage />, 'REPORTS_ANALYTICS.VIEW', 'Reports & Analytics')} />
            <Route path="settings"   element={<SupervisorSettingsPage />} />
            <Route path="profile"   element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </NotificationProvider>
    </SocketProvider>
    </QueryClientProvider>
  );
}
