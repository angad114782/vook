export type NotificationChannel = "inApp" | "email" | "whatsapp";

export type NotificationRuleCategory =
  | "People"
  | "Leave"
  | "Attendance"
  | "Payroll"
  | "Expenses"
  | "Compliance"
  | "Platform";

export const NOTIFICATION_RECIPIENTS = [
  { key: "SUPER_ADMIN", label: "Super Admin" },
  { key: "COMPANY_ADMIN", label: "Company Admin" },
  { key: "HR", label: "HR Admin" },
  { key: "SUPERVISOR", label: "Supervisor" },
  { key: "MANAGER", label: "Manager" },
  { key: "FINANCE", label: "Finance" },
  { key: "EMPLOYEE", label: "Employee" },
] as const;

export type NotificationRecipient = (typeof NOTIFICATION_RECIPIENTS)[number]["key"];
export type NotificationTiming = "immediate" | "15-minutes" | "hourly-digest" | "daily-digest";

export interface NotificationRule {
  id: string;
  title: string;
  description: string;
  category: NotificationRuleCategory;
  recipients: NotificationRecipient[];
  enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
  timing: NotificationTiming;
  reminderEnabled: boolean;
  reminderAfterHours: number;
}

export interface WhatsAppTemplate {
  id: string;
  ruleId: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  enabled: boolean;
}

export interface NotificationSettings {
  channels: { inApp: boolean; email: boolean };
  rules: NotificationRule[];
  whatsapp: {
    enabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    fallbackToInApp: boolean;
    includeCompanyName: boolean;
    templates: WhatsAppTemplate[];
  };
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  { id: "wa-leave-requested", ruleId: "leave-requested", name: "vook_leave_request_submitted", language: "en", status: "APPROVED", enabled: true },
  { id: "wa-leave-decision", ruleId: "leave-decision", name: "vook_leave_request_decision", language: "en", status: "APPROVED", enabled: true },
  { id: "wa-attendance-exception", ruleId: "attendance-exception", name: "vook_attendance_exception", language: "en", status: "APPROVED", enabled: true },
  { id: "wa-payslip-published", ruleId: "payslip-published", name: "vook_payslip_published", language: "en", status: "APPROVED", enabled: true },
  { id: "wa-expense-decision", ruleId: "expense-decision", name: "vook_expense_decision", language: "en", status: "APPROVED", enabled: true },
];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: { inApp: true, email: true },
  rules: [
    {
      id: "employee-onboarded",
      title: "Employee onboarded",
      description: "A new employee record is ready and access has been created.",
      category: "People",
      recipients: ["EMPLOYEE", "HR", "COMPANY_ADMIN"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: true },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "employee-status",
      title: "Employee status or profile changed",
      description: "A manager, HR or administrator updates an employee record or employment status.",
      category: "People",
      recipients: ["EMPLOYEE", "HR", "COMPANY_ADMIN"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "leave-requested",
      title: "Leave request submitted",
      description: "A leave request is waiting for manager review.",
      category: "Leave",
      recipients: ["MANAGER", "SUPERVISOR", "HR"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: true },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "leave-decision",
      title: "Leave request approved or declined",
      description: "The employee and HR are notified when a decision is recorded.",
      category: "Leave",
      recipients: ["EMPLOYEE", "HR"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: true },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "leave-balance-low",
      title: "Leave balance running low",
      description: "An employee's available leave balance falls below the configured threshold.",
      category: "Leave",
      recipients: ["EMPLOYEE", "HR"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "daily-digest",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "attendance-exception",
      title: "Attendance exception",
      description: "A missed punch or regularisation request needs attention.",
      category: "Attendance",
      recipients: ["EMPLOYEE", "SUPERVISOR", "HR"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "regularization-review",
      title: "Attendance regularisation needs review",
      description: "A submitted correction is waiting for supervisor or HR approval.",
      category: "Attendance",
      recipients: ["SUPERVISOR", "HR"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "payroll-review",
      title: "Payroll run ready for review",
      description: "A payroll run is submitted and needs a Finance or HR review before processing.",
      category: "Payroll",
      recipients: ["FINANCE", "HR", "SUPER_ADMIN"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "payslip-published",
      title: "Payslip published",
      description: "An employee can view their newly published payslip.",
      category: "Payroll",
      recipients: ["EMPLOYEE"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: true },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
    {
      id: "expense-decision",
      title: "Expense claim decision",
      description: "An expense claim is approved, declined, or returned for changes.",
      category: "Expenses",
      recipients: ["EMPLOYEE", "MANAGER", "FINANCE"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: true },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "expense-submitted",
      title: "Expense claim submitted",
      description: "A new claim is waiting for manager review or Finance processing.",
      category: "Expenses",
      recipients: ["MANAGER", "FINANCE"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "document-expiry",
      title: "Employee document expiring",
      description: "A compliance document is due to expire within 30 days.",
      category: "Compliance",
      recipients: ["EMPLOYEE", "HR", "COMPANY_ADMIN"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 168,
    },
    {
      id: "workflow-escalation",
      title: "Approval overdue",
      description: "A pending leave or expense approval has reached its escalation time.",
      category: "Platform",
      recipients: ["MANAGER", "SUPERVISOR", "HR", "FINANCE"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: true,
      reminderAfterHours: 24,
    },
    {
      id: "platform-alert",
      title: "Platform or subscription alert",
      description: "A company subscription, service, or support item needs attention.",
      category: "Platform",
      recipients: ["COMPANY_ADMIN", "SUPER_ADMIN"],
      enabled: true,
      channels: { inApp: true, email: true, whatsapp: false },
      timing: "immediate",
      reminderEnabled: false,
      reminderAfterHours: 24,
    },
  ],
  whatsapp: {
    enabled: true,
    quietHoursEnabled: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
    fallbackToInApp: true,
    includeCompanyName: true,
    templates: DEFAULT_WHATSAPP_TEMPLATES,
  },
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const booleanOr = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const saved = asRecord(value);
  const savedChannels = asRecord(saved.channels);
  const savedWhatsapp = asRecord(saved.whatsapp);
  const savedTemplates = Array.isArray(savedWhatsapp.templates) ? savedWhatsapp.templates : [];
  const savedRules = Array.isArray(saved.rules) ? saved.rules : [];

  const rules = DEFAULT_NOTIFICATION_SETTINGS.rules.map((defaultRule) => {
    const savedRule = asRecord(
      savedRules.find((rule) => asRecord(rule).id === defaultRule.id),
    );
    const savedRuleChannels = asRecord(savedRule.channels);
    const allowedRecipients = new Set(NOTIFICATION_RECIPIENTS.map(({ key }) => key));
    const savedRecipients = Array.isArray(savedRule.recipients)
      ? savedRule.recipients.filter((recipient): recipient is NotificationRecipient =>
          typeof recipient === "string" && allowedRecipients.has(recipient as NotificationRecipient),
        )
      : defaultRule.recipients;
    const savedTiming = savedRule.timing;
    const timing: NotificationTiming =
      savedTiming === "15-minutes" || savedTiming === "hourly-digest" || savedTiming === "daily-digest"
        ? savedTiming
        : "immediate";

    return {
      ...defaultRule,
      enabled: booleanOr(savedRule.enabled, defaultRule.enabled),
      recipients: savedRecipients,
      timing,
      reminderEnabled: booleanOr(savedRule.reminderEnabled, defaultRule.reminderEnabled),
      reminderAfterHours:
        typeof savedRule.reminderAfterHours === "number" && savedRule.reminderAfterHours > 0
          ? savedRule.reminderAfterHours
          : defaultRule.reminderAfterHours,
      channels: {
        inApp: booleanOr(savedRuleChannels.inApp, defaultRule.channels.inApp),
        email: booleanOr(savedRuleChannels.email, defaultRule.channels.email),
        whatsapp: booleanOr(
          savedRuleChannels.whatsapp,
          defaultRule.channels.whatsapp,
        ),
      },
    };
  });

  return {
    channels: {
      inApp: booleanOr(
        savedChannels.inApp,
        booleanOr(saved.inApp, DEFAULT_NOTIFICATION_SETTINGS.channels.inApp),
      ),
      email: booleanOr(
        savedChannels.email,
        booleanOr(saved.email, DEFAULT_NOTIFICATION_SETTINGS.channels.email),
      ),
    },
    rules,
    whatsapp: {
      enabled: booleanOr(
        savedWhatsapp.enabled,
        DEFAULT_NOTIFICATION_SETTINGS.whatsapp.enabled,
      ),
      quietHoursEnabled: booleanOr(
        savedWhatsapp.quietHoursEnabled,
        DEFAULT_NOTIFICATION_SETTINGS.whatsapp.quietHoursEnabled,
      ),
      quietHoursStart:
        typeof savedWhatsapp.quietHoursStart === "string"
          ? savedWhatsapp.quietHoursStart
          : DEFAULT_NOTIFICATION_SETTINGS.whatsapp.quietHoursStart,
      quietHoursEnd:
        typeof savedWhatsapp.quietHoursEnd === "string"
          ? savedWhatsapp.quietHoursEnd
          : DEFAULT_NOTIFICATION_SETTINGS.whatsapp.quietHoursEnd,
      fallbackToInApp: booleanOr(
        savedWhatsapp.fallbackToInApp,
        DEFAULT_NOTIFICATION_SETTINGS.whatsapp.fallbackToInApp,
      ),
      includeCompanyName: booleanOr(
        savedWhatsapp.includeCompanyName,
        DEFAULT_NOTIFICATION_SETTINGS.whatsapp.includeCompanyName,
      ),
      templates: DEFAULT_WHATSAPP_TEMPLATES.map((defaultTemplate) => {
        const savedTemplate = asRecord(
          savedTemplates.find((template) => asRecord(template).id === defaultTemplate.id),
        );
        const status = savedTemplate.status;
        return {
          ...defaultTemplate,
          name: typeof savedTemplate.name === "string" ? savedTemplate.name : defaultTemplate.name,
          language: typeof savedTemplate.language === "string" ? savedTemplate.language : defaultTemplate.language,
          status: status === "PENDING" || status === "REJECTED" ? status : "APPROVED",
          enabled: booleanOr(savedTemplate.enabled, defaultTemplate.enabled),
        };
      }),
    },
  };
}
