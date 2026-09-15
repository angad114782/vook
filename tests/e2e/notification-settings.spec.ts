import { expect, test } from "@playwright/test";

test("Super Admin can save HRMS notification rules and open WhatsApp integration", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "SUPER ADMIN", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/settings");
  await page.getByRole("main").getByRole("button", { name: "Notifications", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Notification rules" })).toBeVisible();
  const onboardingRoles = page.getByRole("group", { name: "Recipient roles for Employee onboarded" });
  await onboardingRoles.getByRole("button", { name: "Super Admin" }).click();
  await page.getByRole("button", { name: /Attendance 2 of 2 active/ }).click();
  await page.getByRole("button", { name: "Configure Attendance exception" }).click();
  const attendanceWhatsApp = page.getByRole("checkbox", {
    name: "Attendance exception via WhatsApp",
  });
  await attendanceWhatsApp.check();
  await page.getByRole("button", { name: "Save notification settings" }).click();
  await expect(page.getByText("Notification rules saved")).toBeVisible();

  await page.reload();
  await page.getByRole("main").getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.getByRole("group", { name: "Recipient roles for Employee onboarded" }).getByRole("button", { name: "Super Admin" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Attendance 2 of 2 active/ }).click();
  await page.getByRole("button", { name: "Configure Attendance exception" }).click();
  await expect(page.getByRole("checkbox", {
    name: "Attendance exception via WhatsApp",
  })).toBeChecked();

  await page.getByRole("tab", { name: /WhatsApp/ }).click();
  await expect(page.getByRole("heading", { name: "WhatsApp notifications" })).toBeVisible();
  await expect(page.getByText("Not connected")).toBeVisible();
  await page.getByRole("link", { name: "Configure WhatsApp integration" }).click();
  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WhatsApp Cloud API" })).toBeVisible();
  await expect(page.getByText("WhatsApp Business Account ID")).toBeVisible();
});
