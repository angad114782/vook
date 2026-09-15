export const MOCK_SCHEMA_VERSION = 4;
export const MOCK_PASSWORD = "Demo@123";

export type DemoRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "HR"
  | "FINANCE"
  | "MANAGER"
  | "SUPERVISOR"
  | "EMPLOYEE";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  companyId: string | null;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface MockState {
  schemaVersion: number;
  currentUserId: string | null;
  csrfToken: string;
  users: MockUser[];
  companies: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
  planVersions: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  entitlementOverrides: Array<Record<string, unknown>>;
  roleDefinitions: Array<Record<string, unknown>>;
  roleAssignments: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  reportingLines: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  designations: Array<Record<string, unknown>>;
  offices: Array<Record<string, unknown>>;
  attendance: Array<Record<string, unknown>>;
  attendanceEvents: Array<Record<string, unknown>>;
  attendanceRegularizations: Array<Record<string, unknown>>;
  leaves: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  salaries: Array<Record<string, unknown>>;
  salaryHistory: Array<Record<string, unknown>>;
  payrollRuns: Array<Record<string, unknown>>;
  payslips: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  modules: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  registrations: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  integrations: Array<Record<string, unknown>>;
  attendanceIntegrations: Array<Record<string, unknown>>;
  workflows: Array<Record<string, unknown>>;
  onboarding: Record<string, unknown>;
  onboardings: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
  attendancePolicy: Record<string, unknown>;
}

const iso = (date: Date) => date.toISOString();
const daysFrom = (now: Date, days: number) =>
  iso(new Date(now.getTime() + days * 86_400_000));
const dateOnly = (now: Date, days: number) => daysFrom(now, days).slice(0, 10);

const demoUsers = (now: Date): MockUser[] => {
  const createdAt = daysFrom(now, -180);
  const tenant = "company_northstar";
  return [
    {
      id: "user_super",
      name: "Aarav Mehta",
      email: "superadmin@demo.vook.app",
      role: "SUPER_ADMIN",
      companyId: null,
      isActive: true,
      twoFactorEnabled: true,
      createdAt,
      lastLoginAt: daysFrom(now, -1),
    },
    {
      id: "user_company",
      name: "Nisha Kapoor",
      email: "companyadmin@demo.vook.app",
      role: "COMPANY_ADMIN",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -1),
    },
    {
      id: "user_hr",
      name: "Priya Sharma",
      email: "hr@demo.vook.app",
      role: "HR",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -2),
    },
    {
      id: "user_finance",
      name: "Rohan Iyer",
      email: "finance@demo.vook.app",
      role: "FINANCE",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -2),
    },
    {
      id: "user_manager",
      name: "Kabir Singh",
      email: "manager@demo.vook.app",
      role: "MANAGER",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -3),
    },
    {
      id: "user_supervisor",
      name: "Ananya Rao",
      email: "supervisor@demo.vook.app",
      role: "SUPERVISOR",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -1),
    },
    {
      id: "user_employee",
      name: "Dev Patel",
      email: "employee@demo.vook.app",
      role: "EMPLOYEE",
      companyId: tenant,
      isActive: true,
      createdAt,
      lastLoginAt: daysFrom(now, -1),
    },
  ];
};

export const createMockSeed = (now = new Date()): MockState => {
  const users = demoUsers(now);
  const companies = [
    {
      id: "company_northstar",
      companyCode: "NSM-001",
      name: "Northstar Manufacturing Pvt Ltd",
      legalName: "Northstar Manufacturing Private Limited",
      displayName: "Northstar",
      industry: "Manufacturing",
      email: "people@northstar.demo",
      phone: "+91 98765 10001",
      address: "Pune, Maharashtra",
      plan: "ENTERPRISE",
      status: "ACTIVE",
      maxUsers: 500,
      userCount: 126,
      planExpiry: daysFrom(now, 210),
      createdAt: daysFrom(now, -420),
    },
    {
      id: "company_orbit",
      companyCode: "ORB-014",
      name: "Orbit Retail Labs",
      industry: "Retail",
      email: "admin@orbit.demo",
      phone: "+91 98765 10002",
      address: "Bengaluru, Karnataka",
      plan: "PRO",
      status: "TRIAL",
      maxUsers: 150,
      userCount: 48,
      planExpiry: daysFrom(now, 9),
      createdAt: daysFrom(now, -21),
    },
    {
      id: "company_greenfield",
      companyCode: "GFS-008",
      name: "Greenfield Services",
      industry: "Professional Services",
      email: "ops@greenfield.demo",
      phone: "+91 98765 10003",
      address: "Mumbai, Maharashtra",
      plan: "PRO",
      status: "ACTIVE",
      maxUsers: 150,
      userCount: 92,
      planExpiry: daysFrom(now, 75),
      createdAt: daysFrom(now, -300),
    },
    {
      id: "company_solstice",
      companyCode: "SOL-022",
      name: "Solstice Foods",
      industry: "Food & Beverage",
      email: "hr@solstice.demo",
      phone: "+91 98765 10004",
      address: "Hyderabad, Telangana",
      plan: "BASIC",
      status: "SUSPENDED",
      maxUsers: 50,
      userCount: 37,
      planExpiry: daysFrom(now, -4),
      createdAt: daysFrom(now, -190),
    },
    {
      id: "company_harbor",
      companyCode: "HBR-031",
      name: "Harbor Clinics",
      industry: "Healthcare",
      email: "accounts@harbor.demo",
      phone: "+91 98765 10005",
      address: "Kochi, Kerala",
      plan: "PRO",
      status: "GRACE_PERIOD",
      maxUsers: 250,
      userCount: 118,
      planExpiry: daysFrom(now, -1),
      createdAt: daysFrom(now, -240),
    },
    {
      id: "company_cedar",
      companyCode: "CDR-047",
      name: "Cedar Learning",
      industry: "Education",
      email: "admin@cedar.demo",
      phone: "+91 98765 10006",
      address: "Jaipur, Rajasthan",
      plan: "BASIC",
      status: "EXPIRED",
      maxUsers: 50,
      userCount: 22,
      planExpiry: daysFrom(now, -45),
      createdAt: daysFrom(now, -360),
    },
  ];

  const moduleDefinitions: Array<[string, string, string, string, string[], boolean?]> = [
    ["module_dashboard", "DASHBOARD", "Dashboard", "Core", ["VIEW"], true],
    ["module_support", "SUPPORT", "Support", "Core", ["VIEW", "CREATE", "EDIT"], true],
    ["module_subscription", "SUBSCRIPTION_BILLING", "Subscription & Billing", "Core", ["VIEW"], true],
    ["module_company_settings", "COMPANY_SETTINGS", "Company Settings", "Core", ["VIEW", "EDIT", "CONFIGURE"], true],
    ["module_org", "ORGANIZATION", "Organization", "Organization", ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"]],
    ["module_employees", "EMPLOYEE_MANAGEMENT", "Employee Management", "Workforce", ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "OVERRIDE"]],
    ["module_attendance", "ATTENDANCE", "Attendance", "Workforce", ["VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "EXPORT", "OVERRIDE"]],
    ["module_shift", "SHIFT_MANAGEMENT", "Shift Management", "Workforce", ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"]],
    ["module_leave", "LEAVE_MANAGEMENT", "Leave Management", "Workforce", ["VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "EXPORT", "CONFIGURE"]],
    ["module_approvals", "APPROVALS", "Approvals", "Operations", ["VIEW", "APPROVE", "REJECT", "OVERRIDE", "CONFIGURE"]],
    ["module_payroll", "PAYROLL", "Payroll", "Finance", ["VIEW", "CREATE", "EDIT", "PROCESS", "APPROVE", "FINALIZE", "PUBLISH", "EXPORT", "OVERRIDE"]],
    ["module_payslips", "PAYSLIPS", "Payslips", "Finance", ["VIEW", "CREATE", "PUBLISH", "EXPORT"]],
    ["module_expense", "EXPENSE_MANAGEMENT", "Expense Management", "Finance", ["VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "EXPORT", "PROCESS"]],
    ["module_policies", "POLICIES", "Policies", "Governance", ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"]],
    ["module_documents", "DOCUMENTS", "Documents", "Governance", ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"]],
    ["module_reports", "REPORTS_ANALYTICS", "Reports & Analytics", "Analytics", ["VIEW", "EXPORT"]],
    ["module_notifications", "NOTIFICATIONS", "Notifications", "Communication", ["VIEW", "CREATE", "EDIT", "CONFIGURE"]],
    ["module_roles", "ROLES_PERMISSIONS", "Roles & Permissions", "Governance", ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"], true],
    ["module_integrations", "ATTENDANCE_INTEGRATIONS", "Attendance Integrations", "Integrations", ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"]],
    ["module_api", "API_WEBHOOKS", "API & Webhooks", "Integrations", ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"]],
  ];
  const modules = moduleDefinitions.map(([id, key, name, category, actions, isCore], index) => ({
    id,
    key,
    name,
    description: `${name} controls and operational workspace`,
    category,
    routeKey: key.toLowerCase(),
    status: "ACTIVE",
    actions,
    isCore: Boolean(isCore),
    planSelectable: !isCore,
    sortOrder: index + 1,
  }));

  const plan = (
    id: string,
    name: string,
    type: string,
    monthly: number,
    maxUsers: number,
    moduleCount: number,
  ) => {
    const coreIds = modules.filter((item) => item.isCore).map((item) => item.id);
    const optionalIds = modules.filter((item) => !item.isCore).slice(0, Math.max(0, moduleCount - coreIds.length)).map((item) => item.id);
    const planModuleIds = [...coreIds, ...optionalIds];
    return ({
    id,
    name,
    type,
    status: "PUBLISHED",
    price: monthly,
    annualPrice: monthly * 10,
    maxUsers,
    maxBranches: type === "ENTERPRISE" ? 50 : type === "PRO" ? 10 : 2,
    storageGB: type === "ENTERPRISE" ? 100 : type === "PRO" ? 25 : 5,
    trialEnabled: true,
    defaultTrialDays: 5,
    moduleIds: planModuleIds,
    features: [
      `Up to ${maxUsers} employees`,
      `${moduleCount} operational modules`,
      "Email support",
    ],
    currentVersionId: {
      id: `${id}_v1`,
      version: 1,
      name,
      type,
      currency: "INR",
      pricing: { monthly, annual: monthly * 10 },
      trial: { enabled: true, days: 5 },
      moduleIds: planModuleIds,
      limits: {
        employees: maxUsers,
        branches: type === "ENTERPRISE" ? 50 : 10,
        storageGB: type === "ENTERPRISE" ? 100 : 25,
      },
      features: [`Up to ${maxUsers} employees`],
      publishedAt: daysFrom(now, -120),
    },
    draftRevision: 1,
    versionCount: 1,
    activeSubscriptionCount: type === "PRO" ? 2 : 1,
    });
  };
  const plans = [
    plan("plan_basic", "Starter", "BASIC", 2999, 50, 10),
    plan("plan_pro", "Business", "PRO", 7999, 250, 17),
    plan(
      "plan_enterprise",
      "Enterprise",
      "ENTERPRISE",
      19999,
      500,
      modules.length,
    ),
  ];
  const planVersions = plans.map((item) => ({
    ...(item.currentVersionId as Record<string, unknown>),
    planId: item.id,
    createdAt: daysFrom(now, -120),
  }));
  const allPermissions = modules.flatMap((module) =>
    module.actions.map((action) => `${module.key}.${action}`),
  );
  const permissionsFor = (keys: string[], actions?: string[]) =>
    allPermissions.filter((permission) => {
      const [moduleKey, action] = permission.split(".");
      return keys.includes(moduleKey) && (!actions || actions.includes(action));
    });
  const roleDefinitions = [
    {
      id: "role_company_admin",
      companyId: "company_northstar",
      key: "COMPANY_ADMIN",
      name: "Company Admin",
      kind: "SYSTEM",
      locked: true,
      permissions: allPermissions,
      revision: 1,
    },
    {
      id: "role_hr",
      companyId: "company_northstar",
      key: "HR",
      name: "HR Admin",
      kind: "TEMPLATE",
      locked: false,
      permissions: [
        ...permissionsFor(["DASHBOARD", "ORGANIZATION", "EMPLOYEE_MANAGEMENT", "ATTENDANCE", "SHIFT_MANAGEMENT", "LEAVE_MANAGEMENT", "APPROVALS", "POLICIES", "DOCUMENTS", "REPORTS_ANALYTICS"]),
        ...permissionsFor(["PAYROLL"], ["VIEW"]),
      ],
      revision: 1,
    },
    {
      id: "role_finance",
      companyId: "company_northstar",
      key: "FINANCE",
      name: "Accountant",
      kind: "TEMPLATE",
      locked: false,
      permissions: [
        ...permissionsFor(["DASHBOARD", "PAYROLL", "PAYSLIPS", "EXPENSE_MANAGEMENT", "APPROVALS", "REPORTS_ANALYTICS"]).filter((permission) => !permission.endsWith(".FINALIZE") && !permission.endsWith(".PUBLISH")),
        ...permissionsFor(["ATTENDANCE"], ["VIEW"]),
      ],
      revision: 1,
    },
    {
      id: "role_manager",
      companyId: "company_northstar",
      key: "MANAGER",
      name: "Manager",
      kind: "TEMPLATE",
      locked: false,
      permissions: [
        ...permissionsFor(["DASHBOARD", "EMPLOYEE_MANAGEMENT", "ATTENDANCE", "LEAVE_MANAGEMENT", "APPROVALS", "SHIFT_MANAGEMENT", "REPORTS_ANALYTICS"], ["VIEW", "APPROVE", "REJECT", "EXPORT"]),
        ...permissionsFor(["EXPENSE_MANAGEMENT"], ["VIEW", "APPROVE", "REJECT"]),
      ],
      revision: 1,
    },
    {
      id: "role_supervisor",
      companyId: "company_northstar",
      key: "SUPERVISOR",
      name: "Supervisor",
      kind: "TEMPLATE",
      locked: false,
      permissions: permissionsFor(["DASHBOARD", "EMPLOYEE_MANAGEMENT", "ATTENDANCE", "LEAVE_MANAGEMENT", "APPROVALS", "SHIFT_MANAGEMENT", "REPORTS_ANALYTICS"], ["VIEW", "APPROVE", "REJECT"]),
      revision: 1,
    },
    {
      id: "role_employee",
      companyId: "company_northstar",
      key: "EMPLOYEE",
      name: "Employee",
      kind: "TEMPLATE",
      locked: false,
      permissions: permissionsFor(["DASHBOARD", "ATTENDANCE", "LEAVE_MANAGEMENT", "PAYSLIPS", "EXPENSE_MANAGEMENT", "DOCUMENTS", "NOTIFICATIONS", "SUPPORT"], ["VIEW", "CREATE"]),
      revision: 1,
    },
    {
      id: "role_attendance_coordinator",
      companyId: "company_northstar",
      key: "ATTENDANCE_COORDINATOR",
      name: "Attendance coordinator",
      kind: "CUSTOM",
      locked: false,
      permissions: permissionsFor(["DASHBOARD", "ATTENDANCE"], ["VIEW", "EDIT", "APPROVE", "REJECT", "EXPORT"]),
      revision: 1,
    },
  ];

  const departments = [
    {
      id: "dept_eng",
      companyId: "company_northstar",
      name: "Engineering",
      code: "ENG",
      isActive: true,
      total: 38,
      active: 37,
      branchIds: ["office_pune"],
    },
    {
      id: "dept_ops",
      companyId: "company_northstar",
      name: "Operations",
      code: "OPS",
      isActive: true,
      total: 44,
      active: 42,
      branchIds: ["office_pune", "office_nashik"],
    },
    {
      id: "dept_hr",
      companyId: "company_northstar",
      name: "HR",
      code: "HR",
      isActive: true,
      total: 8,
      active: 8,
      branchIds: [],
    },
    {
      id: "dept_fin",
      companyId: "company_northstar",
      name: "Finance",
      code: "FIN",
      isActive: true,
      total: 12,
      active: 12,
      branchIds: [],
    },
    {
      id: "dept_sales",
      companyId: "company_northstar",
      name: "Sales",
      code: "SAL",
      isActive: true,
      total: 24,
      active: 23,
      branchIds: ["office_pune"],
    },
  ];
  const offices = [
    {
      id: "office_pune",
      _id: "office_pune",
      companyId: "company_northstar",
      name: "Pune HQ",
      code: "PNQ",
      city: "Pune",
      latitude: 18.5204,
      longitude: 73.8567,
      geofenceRadiusMeters: 50000,
      isActive: true,
    },
    {
      id: "office_nashik",
      _id: "office_nashik",
      companyId: "company_northstar",
      name: "Nashik Plant",
      code: "NSK",
      city: "Nashik",
      latitude: 19.9975,
      longitude: 73.7898,
      geofenceRadiusMeters: 50000,
      isActive: true,
    },
  ];
  const designations = [
    {
      id: "des_swe",
      _id: "des_swe",
      companyId: "company_northstar",
      name: "Software Engineer",
      code: "SWE",
      departmentId: { _id: "dept_eng", name: "Engineering" },
      branchIds: [offices[0]],
      isActive: true,
    },
    {
      id: "des_ops",
      _id: "des_ops",
      companyId: "company_northstar",
      name: "Operations Executive",
      code: "OPE",
      departmentId: { _id: "dept_ops", name: "Operations" },
      branchIds: offices,
      isActive: true,
    },
  ];

  const employeeUsers = [users[2], users[3], users[4], users[5], users[6]];
  const extraNames = [
    "Ishaan Verma",
    "Meera Joshi",
    "Arjun Nair",
    "Sara Khan",
    "Vikram Das",
    "Neha Kulkarni",
    "Aditya Bose",
  ];
  const employees = [
    ...employeeUsers.map((user, index) => ({
      id: `employee_${index + 1}`,
      employeeId: `NS-${String(index + 1).padStart(4, "0")}`,
      companyId: "company_northstar",
      branchId: index === 3 ? "office_nashik" : "office_pune",
      departmentId:
        index === 1 ? "dept_fin" : index === 2 || index === 3 ? "dept_ops" : index === 0 ? "dept_hr" : "dept_eng",
      department:
        index === 1
          ? "Finance"
          : index === 2 || index === 3
            ? "Operations"
            : index === 0
              ? "HR"
              : "Engineering",
      designation: index === 4 ? "Software Engineer" : "Team Lead",
      shiftType: index > 1 ? "Morning" : "General",
      shiftTiming: "09:00 - 18:00",
      joiningDate: dateOnly(now, -300 + index * 30),
      annualCtc: 720000 + index * 120000,
      employmentType: index === 3 ? "Contract" : "Permanent",
      status: "ACTIVE",
      mobile: `+91 90000 ${String(10001 + index)}`,
      bankName: "HDFC Bank",
      branchName: "Pune",
      accountHolder: user.name,
      version: 1,
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: "ACTIVE",
        lastLoginAt: user.lastLoginAt,
      },
    })),
    ...extraNames.map((name, index) => ({
      id: `employee_extra_${index + 1}`,
      employeeId: `NS-${String(index + 6).padStart(4, "0")}`,
      companyId: "company_northstar",
      branchId: index % 3 === 1 ? "office_nashik" : "office_pune",
      departmentId: ["dept_eng", "dept_ops", "dept_sales"][index % 3],
      department: ["Engineering", "Operations", "Sales"][index % 3],
      designation: index % 2 ? "Associate" : "Senior Associate",
      shiftType: ["Morning", "Evening", "Night"][index % 3],
      shiftTiming:
        index % 3 === 0
          ? "06:00 - 14:00"
          : index % 3 === 1
            ? "14:00 - 22:00"
            : "22:00 - 06:00",
      joiningDate: dateOnly(now, -240 + index * 12),
      annualCtc: 540000 + index * 45000,
      employmentType: index === 4 ? "Contract" : "Permanent",
      status: index === 6 ? "INACTIVE" : "ACTIVE",
      mobile: `+91 90000 ${String(10006 + index)}`,
      bankName: "ICICI Bank",
      branchName: "Pune",
      accountHolder: name,
      version: 1,
      userId: null,
      user: {
        id: null,
        name,
        email: `${name.toLowerCase().replace(" ", ".")}@northstar.demo`,
        role: "EMPLOYEE",
        accountStatus: "NOT_CREATED",
        lastLoginAt: null,
      },
    })),
  ];
  const teams = [
    {
      id: "team_ops_alpha",
      companyId: "company_northstar",
      branchId: "office_nashik",
      departmentId: "dept_ops",
      name: "Operations Alpha",
      managerEmployeeId: "employee_3",
      supervisorEmployeeId: "employee_4",
      employeeIds: ["employee_4", "employee_extra_2", "employee_extra_5"],
    },
    {
      id: "team_engineering_platform",
      companyId: "company_northstar",
      branchId: "office_pune",
      departmentId: "dept_eng",
      name: "Platform Engineering",
      managerEmployeeId: "employee_3",
      supervisorEmployeeId: "employee_4",
      employeeIds: ["employee_5", "employee_extra_1", "employee_extra_4"],
    },
  ];
  const reportingLines = [
    { id: "line_manager_supervisor", companyId: "company_northstar", managerEmployeeId: "employee_3", reportEmployeeId: "employee_4", relationship: "MANAGER" },
    { id: "line_supervisor_employee", companyId: "company_northstar", managerEmployeeId: "employee_4", reportEmployeeId: "employee_5", relationship: "SUPERVISOR" },
  ];
  const roleAssignments = [
    { id: "assignment_company", _id: "assignment_company", companyId: "company_northstar", userId: "user_company", roleDefinitionId: "role_company_admin", scopeType: "COMPANY", scopeId: "company_northstar", isPrimary: true },
    { id: "assignment_hr", _id: "assignment_hr", companyId: "company_northstar", userId: "user_hr", roleDefinitionId: "role_hr", scopeType: "COMPANY", scopeId: "company_northstar", isPrimary: true },
    { id: "assignment_finance", _id: "assignment_finance", companyId: "company_northstar", userId: "user_finance", roleDefinitionId: "role_finance", scopeType: "COMPANY", scopeId: "company_northstar", isPrimary: true },
    { id: "assignment_manager", _id: "assignment_manager", companyId: "company_northstar", userId: "user_manager", roleDefinitionId: "role_manager", scopeType: "DEPARTMENT", scopeId: "dept_ops", isPrimary: true },
    { id: "assignment_supervisor", _id: "assignment_supervisor", companyId: "company_northstar", userId: "user_supervisor", roleDefinitionId: "role_supervisor", scopeType: "TEAM", scopeId: "team_ops_alpha", isPrimary: true },
    { id: "assignment_supervisor_engineering", _id: "assignment_supervisor_engineering", companyId: "company_northstar", userId: "user_supervisor", roleDefinitionId: "role_supervisor", scopeType: "TEAM", scopeId: "team_engineering_platform", isPrimary: false },
    { id: "assignment_manager_engineering", _id: "assignment_manager_engineering", companyId: "company_northstar", userId: "user_manager", roleDefinitionId: "role_manager", scopeType: "DEPARTMENT", scopeId: "dept_eng", isPrimary: false },
    { id: "assignment_employee", _id: "assignment_employee", companyId: "company_northstar", userId: "user_employee", roleDefinitionId: "role_employee", scopeType: "SELF", scopeId: "employee_5", isPrimary: true },
    { id: "assignment_manager_attendance", _id: "assignment_manager_attendance", companyId: "company_northstar", userId: "user_manager", roleDefinitionId: "role_attendance_coordinator", scopeType: "BRANCH", scopeId: "office_nashik", isPrimary: false },
  ];

  const attendance = employees.flatMap((employee, employeeIndex) =>
    Array.from({ length: 10 }, (_, dayIndex) => {
      const status =
        dayIndex === 3 && employeeIndex % 4 === 0
          ? "Absent"
          : dayIndex === 2 && employeeIndex % 3 === 0
            ? "Late"
            : "Present";
      return {
        id: `attendance_${employeeIndex}_${dayIndex}`,
        companyId: "company_northstar",
        employeeId: employee.id,
        date: dateOnly(now, -dayIndex),
        checkIn:
          status === "Absent" ? null : status === "Late" ? "09:32" : "08:58",
        checkOut: status === "Absent" ? null : "18:04",
        status,
        source: employeeIndex % 2 ? "WEB" : "BIOMETRIC",
      };
    }),
  );
  const attendanceEvents = attendance.flatMap((record) =>
    record.status === "Absent"
      ? []
      : [
          { id: `${record.id}_in`, companyId: record.companyId, employeeId: record.employeeId, attendanceId: record.id, type: "CHECK_IN", occurredAt: `${record.date}T${record.checkIn}:00.000Z`, source: record.source, verification: { gps: "VERIFIED", geofence: "INSIDE", device: "OPTIONAL", ip: "OPTIONAL" } },
          { id: `${record.id}_out`, companyId: record.companyId, employeeId: record.employeeId, attendanceId: record.id, type: "CHECK_OUT", occurredAt: `${record.date}T${record.checkOut}:00.000Z`, source: record.source, verification: { gps: "VERIFIED", geofence: "INSIDE", device: "OPTIONAL", ip: "OPTIONAL" } },
        ],
  );
  const leaves = [
    {
      id: "leave_1",
      companyId: "company_northstar",
      employeeId: "employee_5",
      leaveType: "Casual",
      startDate: dateOnly(now, 4),
      endDate: dateOnly(now, 5),
      days: 2,
      reason: "Family commitment",
      status: "PENDING",
      approvalStage: "SUPERVISOR_RECOMMENDATION",
      version: 1,
      createdAt: daysFrom(now, -2),
    },
    {
      id: "leave_2",
      companyId: "company_northstar",
      employeeId: "employee_2",
      leaveType: "Sick",
      startDate: dateOnly(now, -8),
      endDate: dateOnly(now, -7),
      days: 2,
      reason: "Medical recovery",
      status: "APPROVED",
      version: 2,
      createdAt: daysFrom(now, -12),
    },
    {
      id: "leave_3",
      companyId: "company_northstar",
      employeeId: "employee_extra_2",
      leaveType: "Earned",
      startDate: dateOnly(now, 8),
      endDate: dateOnly(now, 10),
      days: 3,
      reason: "Personal travel",
      status: "PENDING",
      approvalStage: "SUPERVISOR_RECOMMENDATION",
      version: 1,
      createdAt: daysFrom(now, -1),
    },
  ];
  const approvals = leaves
    .filter((item) => item.status === "PENDING")
    .map((item, index) => ({
      id: `approval_${index + 1}`,
      companyId: item.companyId,
      employeeId: item.employeeId,
      entityType: "LEAVE",
      entityId: item.id,
      type: "Leave",
      details: `${item.leaveType} leave · ${item.days} days`,
      date: item.startDate,
      priority: index ? "Medium" : "High",
      status: "PENDING",
      currentStage: "SUPERVISOR_RECOMMENDATION",
      createdAt: item.createdAt,
    }));
  const salaries = employees.map((employee, index) => ({
    id: `salary_${index + 1}`,
    employeeId: employee.id,
    annualCtc: employee.annualCtc,
    basicAnnual: Math.round(Number(employee.annualCtc) * 0.5),
    allowancesAnnual: Math.round(Number(employee.annualCtc) * 0.4),
    deductionsAnnual: Math.round(Number(employee.annualCtc) * 0.1),
    effectiveFrom: employee.joiningDate,
    lastRevised: daysFrom(now, -90),
  }));
  const salaryHistory = salaries.map((salary) => ({
    ...salary,
    id: `${salary.id}_version_1`,
    salaryId: salary.id,
    version: 1,
    effectiveTo: null,
    createdAt: daysFrom(now, -90),
  }));
  const payslips = employees.slice(0, 9).map((employee, index) => ({
    id: `payslip_${index + 1}`,
    payslipId: `PS-${String(index + 1).padStart(5, "0")}`,
    companyId: "company_northstar",
    employeeId: employee.id,
    period: now.toLocaleString("en", { month: "short", year: "numeric" }),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    grossSalary: Math.round(Number(employee.annualCtc) / 12),
    totalDeductions: Math.round(Number(employee.annualCtc) / 120),
    netPay: Math.round(Number(employee.annualCtc) * 0.075),
    status: index < 5 ? "PROCESSED" : "DRAFT",
    paymentStatus: index < 3 ? "PAID" : "PENDING",
    paidAt: index < 3 ? daysFrom(now, -3) : undefined,
    createdAt: daysFrom(now, -5),
  }));
  const payrollRuns = [
    {
      id: "payroll_run_current",
      companyId: "company_northstar",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      status: "UNDER_REVIEW",
      preparedBy: "user_finance",
      approvedBy: null,
      finalizedAt: null,
      publishedAt: null,
      payslipIds: payslips.map((item) => item.id),
      createdAt: daysFrom(now, -5),
    },
  ];
  const expenses = [
    {
      id: "expense_1",
      companyId: "company_northstar",
      employeeId: "employee_5",
      category: "Travel",
      amount: 2840,
      description: "Client site travel",
      status: "PENDING",
      approvalStage: "MANAGER_APPROVAL",
      createdAt: daysFrom(now, -2),
    },
    {
      id: "expense_2",
      companyId: "company_northstar",
      employeeId: "employee_3",
      category: "Materials",
      amount: 6200,
      description: "Workshop supplies",
      status: "APPROVED",
      createdAt: daysFrom(now, -8),
    },
    {
      id: "expense_3",
      companyId: "company_northstar",
      employeeId: "employee_5",
      category: "Utilities",
      amount: 1299,
      description: "Internet reimbursement",
      status: "PAID",
      createdAt: daysFrom(now, -15),
    },
  ];
  const documents = [
    {
      id: "document_1",
      companyId: "company_northstar",
      name: "Employee Handbook",
      category: "HR Policy",
      uploadedBy: "Priya Sharma",
      fileSize: "184 KB",
      version: "2.1",
      visibility: "ALL",
      createdAt: daysFrom(now, -60),
      fileUrl: "/files/document_1",
    },
    {
      id: "document_2",
      companyId: "company_northstar",
      name: "Workplace Safety Policy",
      category: "Safety",
      uploadedBy: "Priya Sharma",
      fileSize: "96 KB",
      version: "1.0",
      visibility: "ALL",
      createdAt: daysFrom(now, -42),
      fileUrl: "/files/document_2",
    },
  ];
  const tickets = [
    {
      id: "ticket_1",
      ticketNo: "SUP-1042",
      companyId: "company_northstar",
      userId: "user_company",
      category: "Attendance",
      subject: "Biometric sync discrepancy",
      description: "Three scans have not appeared in attendance.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      createdAt: daysFrom(now, -2),
      updatedAt: daysFrom(now, -1),
    },
    {
      id: "ticket_2",
      ticketNo: "SUP-1036",
      companyId: "company_orbit",
      userId: "user_super",
      category: "Account",
      subject: "Trial user limit question",
      description: "Please clarify the current trial limit.",
      priority: "LOW",
      status: "PENDING",
      createdAt: daysFrom(now, -5),
      updatedAt: daysFrom(now, -5),
    },
  ];
  const comments = [
    {
      id: "comment_1",
      ticketId: "ticket_1",
      body: "We are checking the device sync logs.",
      isInternal: false,
      createdAt: daysFrom(now, -1),
      authorId: { id: "user_super", name: "Aarav Mehta", role: "SUPER_ADMIN" },
    },
    {
      id: "comment_2",
      ticketId: "ticket_1",
      body: "Thank you. The affected device is NS-PNQ-02.",
      isInternal: false,
      createdAt: daysFrom(now, -1),
      authorId: {
        id: "user_company",
        name: "Nisha Kapoor",
        role: "COMPANY_ADMIN",
      },
    },
  ];
  const notifications = [
    {
      id: "notification_1",
      userId: "user_company",
      type: "SUBSCRIPTION",
      title: "Subscription healthy",
      message: "Enterprise access is active.",
      isRead: false,
      createdAt: daysFrom(now, -1),
      data: {},
    },
    {
      id: "notification_2",
      userId: "user_employee",
      type: "LEAVE",
      title: "Leave request received",
      message: "Your leave request is awaiting review.",
      isRead: false,
      createdAt: daysFrom(now, -2),
      data: { leaveId: "leave_1" },
    },
  ];
  const subscriptions = companies.map((company, index) => {
    const assignedPlan = plans.find((item) => item.type === company.plan) ?? plans[0];
    const assignedVersion = assignedPlan.currentVersionId as Record<string, unknown>;
    return {
    id: `subscription_${index + 1}`,
    companyId: company.id,
    planId: assignedPlan.id,
    planVersionId: assignedVersion.id,
    plan: company.plan,
    billingCycle: index % 2 ? "Monthly" : "Annual",
    amount:
      company.plan === "ENTERPRISE"
        ? 199990
        : company.plan === "PRO"
          ? 7999
          : 2999,
    startDate: daysFrom(now, -90),
    endDate: company.planExpiry,
    status:
      company.status === "SUSPENDED"
        ? "SUSPENDED"
        : company.status === "GRACE_PERIOD"
          ? "PAST_DUE"
          : company.status === "EXPIRED"
            ? "CANCELLED"
        : company.status === "TRIAL"
          ? "TRIAL"
          : "ACTIVE",
    trialEndsAt: company.status === "TRIAL" ? company.planExpiry : undefined,
    currentPeriodEnd: company.planExpiry,
    graceEndsAt: company.status === "SUSPENDED" ? daysFrom(now, 3) : undefined,
    isActive: company.status !== "SUSPENDED",
  };
  });
  const entitlementOverrides = [
    {
      id: "override_orbit_reports",
      companyId: "company_orbit",
      moduleId: "module_reports",
      effect: "GRANT",
      reason: "Sales-assisted trial evaluation",
      expiresAt: daysFrom(now, 9),
      createdBy: "user_super",
      createdAt: daysFrom(now, -2),
    },
    {
      id: "override_orbit_employee_limit",
      companyId: "company_orbit",
      limitKey: "employees",
      effect: "SET_LIMIT",
      oldValue: 250,
      newValue: 175,
      limitValue: 175,
      reason: "Trial capacity agreed during sales-assisted evaluation",
      expiresAt: daysFrom(now, 9),
      createdBy: "user_super",
      createdAt: daysFrom(now, -2),
    },
    {
      id: "override_solstice_payroll",
      companyId: "company_solstice",
      moduleId: "module_payroll",
      effect: "DENY",
      reason: "Module locked while subscription is suspended",
      createdBy: "user_super",
      createdAt: daysFrom(now, -4),
    },
  ];

  return {
    schemaVersion: MOCK_SCHEMA_VERSION,
    currentUserId: null,
    csrfToken: "mock-csrf-v2",
    users,
    companies,
    plans,
    planVersions,
    subscriptions,
    entitlementOverrides,
    roleDefinitions,
    roleAssignments,
    teams,
    reportingLines,
    employees,
    departments,
    designations,
    offices,
    attendance,
    attendanceEvents,
    attendanceRegularizations: [],
    leaves,
    approvals,
    salaries,
    salaryHistory,
    payrollRuns,
    payslips,
    expenses,
    documents,
    modules,
    notifications,
    tickets,
    comments,
    activity: [
      {
        id: "activity_1",
        companyId: "company_northstar",
        action: "EMPLOYEE_CREATED",
        module: "Employees",
        status: "SUCCESS",
        userId: "user_hr",
        createdAt: daysFrom(now, -1),
        description: "Employee profile created",
      },
      {
        id: "activity_2",
        companyId: "company_northstar",
        action: "PAYROLL_REVIEWED",
        module: "Payroll",
        status: "SUCCESS",
        userId: "user_finance",
        createdAt: daysFrom(now, -2),
        description: "Monthly payroll reviewed",
      },
    ],
    payments: [
      {
        id: "payment_1",
        companyId: "company_northstar",
        amount: 199990,
        currency: "INR",
        source: "RAZORPAY",
        status: "PAID",
        reference: "pay_demo_001",
        notes: "Annual renewal",
        createdAt: daysFrom(now, -30),
      },
      {
        id: "payment_2",
        companyId: "company_greenfield",
        amount: 7999,
        currency: "INR",
        source: "OFFLINE",
        status: "PENDING",
        reference: "BANK-4472",
        notes: "Awaiting reconciliation",
        createdAt: daysFrom(now, -4),
      },
    ],
    invoices: [
      { id: "invoice_1", companyId: "company_northstar", subscriptionId: "subscription_1", number: "INV-2026-0042", amountMinor: 1999900, currency: "INR", status: "PAID", issuedAt: daysFrom(now, -30), paidAt: daysFrom(now, -30) },
      { id: "invoice_2", companyId: "company_greenfield", subscriptionId: "subscription_3", number: "INV-2026-0048", amountMinor: 799900, currency: "INR", status: "PENDING", issuedAt: daysFrom(now, -4), paidAt: null },
    ],
    registrations: [],
    audit: [
      { id: "audit_1", companyId: "company_northstar", actorId: "user_company", action: "ROLE_PERMISSION_UPDATED", entityType: "ROLE_DEFINITION", entityId: "role_hr", oldValue: { revision: 0 }, newValue: { revision: 1 }, ip: "127.0.0.1", device: "Chrome on Windows", requestId: "seed_request_1", createdAt: daysFrom(now, -3) },
      { id: "audit_2", companyId: "company_northstar", actorId: "user_finance", action: "PAYROLL_REVIEWED", entityType: "PAYROLL_RUN", entityId: "payroll_run_current", oldValue: { status: "CALCULATED" }, newValue: { status: "UNDER_REVIEW" }, ip: "127.0.0.1", device: "Chrome on Windows", requestId: "seed_request_2", createdAt: daysFrom(now, -2) },
    ],
    integrations: [
      {
        id: "integration_razorpay",
        providerKey: "RAZORPAY",
        displayName: "Razorpay",
        category: "PAYMENTS",
        available: true,
        status: "ACTIVE",
        publicFields: [{ key: "keyId", label: "Key ID", required: true }, { key: "environment", label: "Environment", required: true }],
        secretFields: [{ key: "keySecret", label: "Key secret", required: true }, { key: "webhookSecret", label: "Webhook secret", required: true }],
        publicConfig: { keyId: "rzp_test_demo", environment: "sandbox" },
        secretConfigured: true,
        pendingConfiguration: false,
        lastTestedAt: daysFrom(now, -7),
      },
      {
        id: "integration_payu",
        providerKey: "PAYU",
        displayName: "PayU",
        category: "PAYMENTS",
        available: true,
        status: "DRAFT",
        publicFields: [{ key: "merchantKey", label: "Merchant key", required: true }, { key: "environment", label: "Environment", required: true }],
        secretFields: [{ key: "merchantSalt", label: "Merchant salt", required: true }],
        publicConfig: { environment: "sandbox" },
        secretConfigured: false,
        pendingConfiguration: true,
        lastTestedAt: null,
      },
      {
        id: "integration_smtp",
        providerKey: "SMTP",
        displayName: "Email delivery",
        category: "MESSAGING",
        available: true,
        status: "DRAFT",
        publicFields: [{ key: "host", label: "SMTP host", required: true }, { key: "port", label: "Port", required: true }, { key: "fromAddress", label: "From address", required: true }],
        secretFields: [{ key: "username", label: "Username", required: true }, { key: "password", label: "Password", required: true }],
        publicConfig: { port: 587, fromAddress: "notifications@vook.example" },
        secretConfigured: false,
        pendingConfiguration: true,
        lastTestedAt: null,
      },
      {
        id: "integration_whatsapp",
        providerKey: "WHATSAPP",
        displayName: "WhatsApp Cloud API",
        category: "WHATSAPP",
        available: true,
        status: "NOT_CONFIGURED",
        publicFields: [{ key: "phoneNumberId", label: "Phone Number ID", required: true }, { key: "businessAccountId", label: "WhatsApp Business Account ID", required: false }],
        secretFields: [{ key: "accessToken", label: "Permanent access token", required: true }],
        publicConfig: {},
        secretConfigured: false,
        pendingConfiguration: false,
        lastTestedAt: null,
      },
    ],
    attendanceIntegrations: [
      { id: "attendance_connection_mobile", scope: "GLOBAL", providerKey: "MOBILE_GEOLOCATION", displayName: "Employee mobile GPS", connectionMode: "MOBILE", status: "ACTIVE", publicConfig: {}, deviceSerials: [], secretConfigured: false, lastTestedAt: daysFrom(now, -5), createdAt: daysFrom(now, -20) },
      { id: "attendance_connection_biostar", scope: "GLOBAL", providerKey: "SUPREMA_BIOSTAR", displayName: "Main fingerprint and face terminal", connectionMode: "LOCAL_BRIDGE", status: "ACTIVE", publicConfig: { bridgeId: "vook-main-bridge" }, deviceSerials: ["SUP-FA-41082", "SUP-FA-41083"], secretConfigured: true, lastTestedAt: daysFrom(now, -2), createdAt: daysFrom(now, -18) },
    ],
    workflows: [
      {
        type: "leave",
        steps: [
          {
            order: 1,
            role: "MANAGER",
            action: "Review & Approve",
            escalateAfter: 24,
          },
          { order: 2, role: "HR", action: "Final Approval", escalateAfter: 24 },
        ],
        autoEscalate: true,
        escalateHours: 24,
      },
      {
        type: "expense",
        steps: [
          {
            order: 1,
            role: "MANAGER",
            action: "Review & Approve",
            escalateAfter: 24,
          },
          {
            order: 2,
            role: "FINANCE",
            action: "Final Approval",
            escalateAfter: 48,
          },
        ],
        autoEscalate: true,
        escalateHours: 24,
      },
      {
        type: "correction",
        steps: [
          {
            order: 1,
            role: "SUPERVISOR",
            action: "Review & Approve",
            escalateAfter: 12,
          },
        ],
        autoEscalate: true,
        escalateHours: 12,
      },
    ],
    onboarding: {
      status: "IN_PROGRESS",
      steps: [
        { key: "company-profile", status: "COMPLETED", completedAt: daysFrom(now, -10) },
        { key: "first-branch", status: "COMPLETED", completedAt: daysFrom(now, -9) },
        { key: "organization", status: "COMPLETED", completedAt: daysFrom(now, -8) },
        { key: "roles", status: "IN_PROGRESS" },
        { key: "shifts-holidays", status: "NOT_STARTED" },
        { key: "attendance-policy", status: "NOT_STARTED" },
        { key: "leave-policy", status: "NOT_STARTED" },
        { key: "workflows", status: "NOT_STARTED" },
        { key: "payroll", status: "NOT_STARTED" },
        { key: "expenses", status: "NOT_STARTED" },
        { key: "employees", status: "NOT_STARTED" },
        { key: "invitations", status: "NOT_STARTED" },
      ],
    },
    onboardings: [
      {
        companyId: "company_northstar",
        status: "IN_PROGRESS",
        steps: [
          { key: "company-profile", status: "COMPLETED", completedAt: daysFrom(now, -10) },
          { key: "first-branch", status: "COMPLETED", completedAt: daysFrom(now, -9) },
          { key: "organization", status: "COMPLETED", completedAt: daysFrom(now, -8) },
          { key: "roles", status: "IN_PROGRESS" },
          { key: "shifts-holidays", status: "NOT_STARTED" },
          { key: "attendance-policy", status: "NOT_STARTED" },
          { key: "leave-policy", status: "NOT_STARTED" },
          { key: "workflows", status: "NOT_STARTED" },
          { key: "payroll", status: "NOT_STARTED" },
          { key: "expenses", status: "NOT_STARTED" },
          { key: "employees", status: "NOT_STARTED" },
          { key: "invitations", status: "NOT_STARTED" },
        ],
      },
    ],
    settings: {
      general: {
        platformName: "Vook",
        platformUrl: "https://app.vook.example",
        supportEmail: "support@vook.example",
      },
      security: { twoFA: true, sessionTimeout: 30 },
      notifications: { email: true, inApp: true },
      system: { maxUsers: 5000, maintenance: false, maintenanceMsg: "" },
    },
    attendancePolicy: {
      standardStart: "09:00",
      standardEnd: "18:00",
      graceMinutes: 15,
      overtimeAfterMinutes: 30,
      breakMinutes: 60,
      weeklyOffs: [0, 6],
      verification: { gpsRequired: true, geofenceRequired: true, deviceRequired: false, ipRequired: false, selfieRequired: false, biometricEnabled: false },
    },
  };
};

export const demoAccounts = createMockSeed(
  new Date("2026-09-14T09:00:00.000Z"),
).users.map(({ name, email, role }) => ({
  name,
  email,
  role,
  password: MOCK_PASSWORD,
}));
