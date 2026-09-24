import { LayoutDashboard, Settings, UserCircle } from "lucide-react";
import RoleSidebar from "./RoleSidebar";
import { assignableRoleGroups } from "./assignableRoleNavigation";

const groups = assignableRoleGroups("/employee", {
  payroll: "/employee/payslips",
})
  .map((group) => ({
    ...group,
    entries: group.entries.filter(
      (entry) =>
        !("to" in entry && entry.to === "/employee/payslips" && entry.label !== "Payslips"),
    ),
  }))
  .filter((group) => group.entries.length > 0);

interface EmployeeSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function EmployeeSidebar(props: EmployeeSidebarProps) {
  return (
    <RoleSidebar
      {...props}
      portalKey="employee"
      roleLabel="Employee"
      workspaceLabel="My workspace"
      dashboard={{
        to: "/employee/dashboard",
        label: "Dashboard",
        Icon: LayoutDashboard,
      }}
      groups={groups}
      accountLinks={[
        { to: "/employee/profile", label: "Profile", Icon: UserCircle },
        { to: "/employee/settings", label: "My settings", Icon: Settings },
      ]}
    />
  );
}
