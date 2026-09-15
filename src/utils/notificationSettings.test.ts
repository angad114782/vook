import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
} from "./notificationSettings";

describe("normalizeNotificationSettings", () => {
  it("supplies HRMS rules while reading the existing legacy channel settings", () => {
    const result = normalizeNotificationSettings({ email: false, inApp: true });

    expect(result.channels).toEqual({ inApp: true, email: false });
    expect(result.rules.map((rule) => rule.id)).toEqual(
      DEFAULT_NOTIFICATION_SETTINGS.rules.map((rule) => rule.id),
    );
  });

  it("keeps saved rule and WhatsApp preferences and fills missing defaults", () => {
    const result = normalizeNotificationSettings({
      rules: [
        {
          id: "leave-requested",
          enabled: false,
          channels: { email: false, whatsapp: true },
        },
      ],
      whatsapp: { enabled: false, quietHoursStart: "20:00" },
    });

    const leaveRule = result.rules.find((rule) => rule.id === "leave-requested");
    expect(leaveRule).toMatchObject({
      enabled: false,
      channels: { inApp: true, email: false, whatsapp: true },
    });
    expect(result.whatsapp).toMatchObject({
      enabled: false,
      quietHoursEnabled: true,
      quietHoursStart: "20:00",
      quietHoursEnd: "08:00",
    });
    expect(result.whatsapp.templates).toHaveLength(5);
  });

  it("keeps saved WhatsApp template mappings and fills missing templates", () => {
    const result = normalizeNotificationSettings({
      whatsapp: {
        templates: [{ id: "wa-leave-requested", name: "custom_leave_template", language: "hi", enabled: false }],
      },
    });

    expect(result.whatsapp.templates.find((template) => template.id === "wa-leave-requested")).toMatchObject({
      name: "custom_leave_template",
      language: "hi",
      enabled: false,
    });
    expect(result.whatsapp.templates.find((template) => template.id === "wa-payslip-published")).toBeDefined();
  });
});
