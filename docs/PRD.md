# Vook — Product Requirements Document (PRD)

## 1. Overview
Vook is a multi-tenant **HRMS + ERP SaaS**. One platform operator (Super Admin) sells plans to companies; each company runs HR, attendance, leave, payroll, expenses, documents and approvals for its own employees. The frontend is a standalone React app that runs in **mock (demo) mode** or against a **v2 REST API** (see `openapi-v2.yaml`).

## 2. Goals
- Single product serving 6 personas with role- and plan-driven navigation.
- Correct payroll (integer money, effective-dated salary, immutable published payslips).
- Plan → module entitlements controlling what each tenant sees.
- Secure by default: server-side tenant isolation, RBAC + scope, audit trail.
- Swap data source (mock ↔ API) with zero page changes.

## 3. Non-goals (current phase)
- Microservices (modular monolith first — see `hrms-architecture-blueprint.md`).
- Native mobile apps (responsive web/PWA only).
- Deployment automation inside this repo.

## 4. Personas & roles
| Role | Portal | Core jobs |
|---|---|---|
| Super Admin | `/super-admin` | Companies, plans & versions, subscriptions, modules, payments, integrations, support, audit, platform settings |
| Company Admin | `/company-admin` | Dashboard, workforce, org, roles/permissions, workflows, plan & billing, payroll authorize/publish, reports |
| HR | `/hr` | Employees, attendance, leave, approvals, documents, holiday calendar |
| Finance | `/finance` | Payroll prepare/review, salary structure, payslips, expenses, reports |
| Manager | `/manager` | Team workforce, approvals, attendance, reports |
| Supervisor | `/supervisor` | Shift management, team attendance, approvals |
| Employee | `/employee` | Self attendance, leave, payslips, expenses, documents, profile |

Users may hold **multiple role assignments**; permissions are unioned but each record must match an assignment that grants the permission and covers its scope (company / branch / department / team / self).

## 5. Functional requirements

### 5.1 Auth & account
- Login, forgot/reset password, accept invitation, email verification, change password.
- Session management (list/revoke sessions, revoke-all), 2FA (setup/verify/status).
- Self-serve registration → onboarding steps → trial or checkout.

### 5.2 SaaS control plane (Super Admin)
- Plans edited as **drafts**; `publish` creates immutable numbered `PlanVersion`.
- Subscriptions pin `planVersionId`; migration is explicit.
- Effective entitlement = pinned version + active, auditable company overrides. Core modules cannot be removed.
- Module catalog, per-company module toggles, module permissions.
- Payments (online + offline), invoices, broadcasts, platform settings, integrations.

### 5.3 Organization & employees
- Companies, offices, departments, teams, designations, reporting lines.
- Employee CRUD, bulk import, lifecycle actions, linked user account.
- Documents (company + employee) with policies and expiries.

### 5.4 Attendance & shifts
- Self check-in/out, today view, summary, manager/HR views.
- Regularization requests with approval actions.
- Shift templates/assignments; attendance policy; verification policy.
- Device/biometric integration normalized to one `AttendanceEvent`. The platform admin adds any provider (face-only, fingerprint-only or both) and a connection with a mandatory API key + token; each company registers any number of its own devices by serial number and branch, and all of them feed one attendance sheet. The platform admin only enters provider name, what it reads, API key and token. The company admin describes each real machine: serial number, model number and place name. Each device can allow everyone in the company, only the staff of its branch, or chosen people.

### 5.5 Leave & holidays
- Leave types, balances, requests, approve/reject/cancel with comments.
- Holiday calendar.

### 5.6 Approvals & workflows
- Unified approvals inbox (leave, regularization, expense, etc.).
- Configurable workflow per request type; in-flight requests keep their original version.

### 5.7 Payroll (critical)
- Effective-dated salary structures.
- Flow: **Finance prepares → reviews → Company Admin authorizes → finalizes → publishes.**
- Published payslips immutable; recalculation only before finalize.
- Payslip download (PDF), pay action, compliance & payroll reports.
- Money in **integer minor units + ISO currency**.

### 5.8 Expenses
- Claim with receipt upload, approval chain, reimbursement status.

### 5.9 Notifications, support, realtime
- Inbox, preferences, broadcast; realtime `notification:created`.
- Support tickets with comments, presence, typing, read/delivered cursors.

### 5.10 Reports, audit, activity
- Reports by kind with async export; activity feed; immutable audit events.

### 5.11 Search
- Global search constrained by permissions and tenant.

## 6. Non-functional requirements
| Area | Target |
|---|---|
| Performance | List pages < 2s p95 on 4G; virtualized large tables; cursor pagination |
| Concurrency | **1,000 simultaneous users** (design for 10×) with p95 < 500 ms, error rate < 0.1%, no crashes; peaks like 9 AM punch-in and payroll day must not degrade the experience |
| Availability | Graceful degradation when realtime/integration down; overload returns a friendly "try again in a moment", never a crash |
| Accessibility | WCAG 2.1 AA: skip link, focus rings, labelled controls |
| Responsive | Desktop dense tables; mobile cards/bottom sheets |
| Security | See `SECURITY.md` |
| Observability | Request ID on every error; structured logging server-side |
| Browser | Latest 2 versions of Chrome, Edge, Safari, Firefox |

## 6a. Product principle: simple for non-technical users
Vook's users are HR, finance, supervisors and employees — most are not technical. **Ease of use is a release requirement, not polish.**
- Every action is visible and labelled in plain language; nothing is hidden behind a trick or a technical convention.
- Creating something you need (a department, a designation) happens right where you need it, without leaving the screen.
- Imports and forms accept the formats people really use, show a preview, and explain mistakes in plain words with how to fix them.
- Every screen has helper text, a friendly empty state and a clear next step.
- **Acceptance test for every feature:** a new HR assistant completes the task unaided in under 2 minutes.
Detailed rules: see `RULES.md` → "User-friendly first".

## 7. Success metrics
- Time to onboard a new company < 15 min.
- Payroll run for 500 employees < 5 min end-to-end review.
- Zero cross-tenant data leakage incidents.
- New-user task success without help ≥ 90% (add employee, apply leave, import employees).
- ≥ 95% of approvals actioned within SLA configured per workflow.

## 8. Release phases
1. **Foundation** — auth, tenancy, RBAC, plans/entitlements, mock mode.
2. **Core HR** — employees, org, attendance, leave, approvals.
3. **Money** — payroll, payslips, expenses, payments/checkout.
4. **Platform** — support, notifications, integrations, reports, audit.
5. **Scale** — recruitment, performance, assets, SMS/WhatsApp channels.

## 9. Open questions
- Final payment provider mix (Razorpay / PayU) per region?
- Statutory compliance scope (PF/ESI/TDS) per country?
- Data retention periods for audit and payroll snapshots?
