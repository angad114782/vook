import {
  BarChart2,
  CalendarDays,
  CheckSquare,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  Receipt,
  Users,
} from 'lucide-react';
import type { RoleNavGroup } from './RoleSidebar';

export interface AssignableRolePaths {
  workforce?: string;
  attendance?: string;
  shifts?: string;
  leaves?: string;
  calendar?: string;
  approvals?: string;
  payroll?: string;
  payslips?: string;
  expenses?: string;
  documents?: string;
  reports?: string;
}

/**
 * Tenant roles share one module catalogue. Entitlements and effective role
 * permissions decide which entries RoleSidebar exposes for the signed-in user.
 */
export function assignableRoleGroups(basePath: string, paths: AssignableRolePaths = {}): RoleNavGroup[] {
  const path = (key: keyof AssignableRolePaths, fallback: string) => paths[key] ?? `${basePath}/${fallback}`;

  return [
    {
      label: 'Workforce',
      entries: [
        { to: path('workforce', 'workforce'), label: 'Employee management', Icon: Users },
        { to: path('attendance', 'attendance'), label: 'Attendance', Icon: Clock },
        { to: path('shifts', 'shifts'), label: 'Shift management', Icon: CalendarDays },
        { to: path('leaves', 'leaves'), label: 'Leave management', Icon: CalendarDays },
        { to: path('calendar', 'calendar'), label: 'Holiday calendar', Icon: CalendarDays },
      ],
    },
    {
      label: 'Operations',
      entries: [
        { to: path('approvals', 'approvals'), label: 'Approvals', Icon: CheckSquare },
      ],
    },
    {
      label: 'Finance',
      entries: [
        { to: path('payroll', 'payroll'), label: 'Payroll', Icon: CreditCard },
        { to: path('payslips', 'payslips'), label: 'Payslips', Icon: FileText },
        { to: path('expenses', 'expenses'), label: 'Expenses', Icon: Receipt },
      ],
    },
    {
      label: 'Records & insights',
      entries: [
        { to: path('documents', 'documents'), label: 'Documents', Icon: FolderOpen },
        { to: path('reports', 'reports'), label: 'Reports', Icon: BarChart2 },
      ],
    },
  ];
}
