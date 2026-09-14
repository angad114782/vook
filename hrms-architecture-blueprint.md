# HRMS Architecture Blueprint

**Target deployment:** Single Hostinger KVM 8 VPS (8 vCPU / 32 GB RAM / 400 GB NVMe / 32 TB bandwidth)
**Design principle:** Modular monolith first — extract services only when a specific module's load actually demands it.

---

## Table of Contents

1. [Architecture Shape](#1-architecture-shape)
2. [Stack](#2-stack)
3. [Folder Structure](#3-folder-structure)
4. [Module Manifests](#4-module-manifests)
5. [Multi-Tenancy](#5-multi-tenancy)
6. [Tenant Isolation Enforcement](#6-tenant-isolation-enforcement)
7. [Auth vs. Authorization vs. Entitlements](#7-auth-vs-authorization-vs-entitlements)
8. [Dynamic RBAC + ABAC](#8-dynamic-rbac--abac)
9. [Plans & Entitlements](#9-plans--entitlements)
10. [Module Catalog](#10-module-catalog)
11. [Workflow Engine](#11-workflow-engine)
12. [Internal Event-Driven Design](#12-internal-event-driven-design)
13. [Notification Platform](#13-notification-platform)
14. [Realtime Strategy](#14-realtime-strategy)
15. [Support System](#15-support-system)
16. [Provider Abstractions](#16-provider-abstractions)
17. [Biometric/Attendance Integration](#17-biometricattendance-integration)
18. [MongoDB Data Access](#18-mongodb-data-access)
19. [Pagination](#19-pagination)
20. [Avoiding N+1 Queries](#20-avoiding-n1-queries)
21. [Caching Policy](#21-caching-policy)
22. [Background Jobs](#22-background-jobs)
23. [Payroll Correctness](#23-payroll-correctness)
24. [Effective-Dated Configuration](#24-effective-dated-configuration)
25. [Frontend Architecture](#25-frontend-architecture)
26. [Desktop vs. Mobile UI](#26-desktop-vs-mobile-ui)
27. [Version Verification Note](#27-version-verification-note)

---

## 1. Architecture Shape

**Modular Monolith + Worker + Realtime Gateway.** No microservices at this stage — the operational cost (service discovery, distributed tracing, distributed transactions, N deployments) isn't justified on a single VPS, and every module already has a hard internal boundary, so extraction later is cheap if one module (payroll, most likely) outgrows the box.

```
                              INTERNET
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  Caddy / Nginx    │
                        │  TLS + compression│
                        └────────┬──────────┘
                                 │
             ┌───────────────────┼────────────────────┐
             ▼                   ▼                     ▼
       React Web/PWA       Fastify API           Realtime Gateway
                                 │                (SSE / WebSocket)
                    ┌────────────┼─────────────────────┐
                    ▼            ▼                      ▼
                 MongoDB      Valkey               Job Workers
                    │      (cache, locks,         (notifications,
                    │     rate limits, queues,     payroll, imports/
                    │        pub/sub)             exports, reports,
                    │                              PDF generation)
                    ▼
           Local Object Storage
           (via StorageProvider)
```

The app stays one deployable product, but each business domain (attendance, payroll, leave, etc.) is isolated enough internally that it *could* become its own service without a rewrite.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24 LTS |
| Language | TypeScript, strict mode, ESM-first |
| Backend framework | Fastify 5.x |
| Frontend | React 19.x + Vite |
| UI | shadcn/ui (New York style, neutral base) + Tailwind CSS v4 (`@theme` CSS-first config) |
| Routing | TanStack Router |
| Server state | TanStack Query v5 |
| Client-only UI state | Zustand — only where genuinely needed |
| Tables | TanStack Table + TanStack Virtual |
| Forms | React Hook Form |
| Validation / API schemas | **Zod** |
| Database | MongoDB Community, native Node driver (no Mongoose) |
| Cache | Valkey |
| Background jobs | BullMQ |
| Realtime | SSE + Socket.IO/WebSocket |
| Auth | Better Auth (session/MFA layer) + a custom `AuthorizationService` for permissions/entitlements |
| Observability | Pino (logs) + OpenTelemetry + Prometheus + Grafana + Loki |
| Proxy/TLS | Caddy or Nginx |
| Containers | Docker + Docker Compose |
| Testing | Vitest + Playwright + Testcontainers + k6 |
| Package manager | pnpm, workspaces + Turborepo |

**Note:** validation is Zod, not TypeBox — matches the schema/validation choice already set for the rest of the platform, and keeps one validation library across the whole codebase instead of two.

Rationale worth keeping in mind:
- **Valkey over managed Redis** — avoids a proprietary managed-cache dependency, and its recent memory-efficiency work matters on a fixed-RAM box running cache and app side by side.
- **Native MongoDB driver over Mongoose** — keeps domain logic out of ORM models; repositories own the mapping.
- **BullMQ** — MIT-licensed, no external broker beyond Valkey.

---

## 3. Folder Structure

Organize by business capability, not by technical layer — `controllers/services/models/` becomes a dumping ground once the app grows; a manifest-per-module structure doesn't.

```
hrms/
├── apps/
│   ├── web/
│   ├── api/
│   ├── worker/
│   └── realtime/
│
├── packages/
│   ├── ui/
│   ├── contracts/
│   ├── authz/
│   ├── observability/
│   ├── config/
│   ├── testing/
│   └── shared-kernel/
│
├── modules/
│   ├── tenancy/          ├── payroll/            ├── notifications/
│   ├── identity/         ├── expenses/           ├── support/
│   ├── employees/        ├── recruitment/        ├── audit/
│   ├── organization/     ├── performance/        ├── reporting/
│   ├── attendance/       ├── documents/          ├── integrations/
│   ├── shifts/           ├── assets/             └── subscriptions/
│   ├── leave/            ├── workflows/
│
└── infrastructure/
    ├── docker/
    ├── caddy/
    ├── prometheus/
    ├── grafana/
    └── scripts/
```

Inside each module:

```
employees/
├── domain/            employee.entity.ts, employee-policy.ts, employee-events.ts, employee.errors.ts
├── application/       commands/, queries/, use-cases/, ports/
├── infrastructure/    mongo/, cache/, adapters/
├── api/               routes/, schemas/, presenters/
└── manifest.ts
```

---

## 4. Module Manifests

Every module self-declares through a manifest — navigation, routes, permissions, features, events, jobs, notification templates, audit actions, and policies. A registry builds navigation, authorization metadata, API registration, and background handlers from these manifests.

```ts
export const payrollModule = defineModule({
  id: "payroll",
  version: 1,
  navigation: [...],
  routes: [...],
  permissions: [
    "payroll.read", "payroll.run", "payroll.approve",
    "payroll.payslip.read", "payroll.settings.manage",
  ],
  features: ["payroll", "payroll.reimbursements", "payroll.loans"],
  events: [...],
  jobs: [...],
  notificationTemplates: [...],
  auditActions: [...],
  policies: [...],
});
```

Adding a new module (e.g. `travel/`) means writing `manifest.ts` + the standard folders and registering it once — not touching 20 unrelated files.

---

## 5. Multi-Tenancy

**Shared MongoDB database, shared collections, `tenantId` isolation.** Don't go to database-per-tenant at this stage.

Every tenant-owned document carries `tenantId`, and every index starts with it:

```ts
{ tenantId: 1, employeeCode: 1 }                    // unique
{ tenantId: 1, departmentId: 1, status: 1 }
{ tenantId: 1, employeeId: 1, date: -1 }
{ tenantId: 1, createdAt: -1 }
```

---

## 6. Tenant Isolation Enforcement

Never trust `tenantId` from the client:

```
❌  GET /employees?tenantId=abc
❌  Employee.find({ tenantId: request.query.tenantId })
```

Resolve it server-side and thread it through a context object instead:

```
session → membership → active tenant → TenantContext → repository
```

```ts
employeeRepository.findMany(ctx, filters)
// ctx.tenantId, ctx.userId, ctx.permissions, ctx.scope, ctx.requestId
```

The repository injects `{ tenantId: ctx.tenantId }` automatically. **Raw database access from controllers or use-cases should be disallowed outright** — repositories are the only path to Mongo.

---

## 7. Auth vs. Authorization vs. Entitlements

Three separate questions that must never collapse into one `if`:

| System | Question |
|---|---|
| Authentication | Who are you? |
| Authorization | What are you allowed to do? |
| Entitlements | What did this tenant purchase/enable? |

An admin with `payroll.run` still gets denied if the tenant's plan doesn't include payroll. The final access check is roughly:

```
authenticated
AND tenant active
AND feature enabled
AND permission granted
AND record scope allowed
AND business policy allowed
```

This replaces `if (user.role === "admin")` everywhere.

---

## 8. Dynamic RBAC + ABAC

Don't hardcode `Admin / HR / Manager / Employee` as fixed roles — ship them as templates, but let tenants create their own (`HR Executive`, `Payroll Manager`, `Regional HR`, etc.) built from a fixed permission set:

```
employee.read / create / update / terminate
attendance.read / correct / approve
leave.read / request / approve
payroll.read / run / approve, payslip.read
```

Add scopes on top: `SELF, TEAM, DEPARTMENT, LOCATION, TENANT, CUSTOM`. A manager might hold `employee.read` scoped to `TEAM`; HR holds the same permission scoped to `TENANT`. That's RBAC + ABAC without hardcoded roles.

Better Auth has an official MongoDB adapter and org/access-control primitives — use it for authentication/session handling, but keep the actual authorization engine behind your own `AuthorizationService` interface so the app isn't locked to one auth library.

---

## 9. Plans & Entitlements

```ts
{
  "plan": "growth",
  "features": { "employees": true, "attendance": true, "leave": true, "payroll": false, "recruitment": true },
  "limits": { "employees": 250, "locations": 10, "storageGB": 20 }
}
```

`Plan → PlanFeature → TenantSubscription → TenantEntitlement → UsageLimit`, with super-admin overrides layered on top:

```
Plan features + Tenant overrides = Effective entitlements
```

Cache the effective entitlements in Valkey — they're read on nearly every request.

---

## 10. Module Catalog

| Domain | Capabilities |
|---|---|
| SaaS Control Plane | tenants, plans, subscriptions, entitlements, feature flags, quotas |
| Identity | login, MFA, sessions, password recovery, devices |
| Authorization | roles, permissions, scopes, policies |
| Employee Core | profiles, employment, lifecycle, status |
| Organization | legal entities, branches, departments, teams, designations |
| Onboarding / Offboarding | checklists, approvals, joining / resignation, clearance, exit |
| Attendance | punches, regularization, biometric events |
| Shift | templates, rosters, weekly offs |
| Leave / Holidays | types, balances, accruals, approvals, calendars |
| Payroll / Compensation | structures, runs, approvals, payslips, revisions, history |
| Expenses / Assets | claims, reimbursement, device allocation & returns |
| Documents | employee/company files and expiries |
| Recruitment | jobs, candidates, interviews, offers |
| Performance / Training | cycles, goals, reviews, course completion |
| Workflow | configurable approval processes |
| Notifications | inbox / email / push |
| Reporting / Audit | dashboards, exports, scheduled reports, immutable activity history |
| Support | ticketing, chat, attachments, internal notes |
| Integrations | biometrics, email, webhooks, payroll/banking providers |
| Super Admin | tenants, plans, health, support, usage |

Don't build all of these before launch — but design the extension points (manifest + ports) from day one so adding a module later is additive, not a refactor.

---

## 11. Workflow Engine

Approval chains differ per tenant — one company wants `Employee → Manager → HR`, another wants `Employee → Team Lead → Manager → HR`, another wants conditional branching (`Director if > 5 days`). Model this explicitly rather than hardcoding a chain:

```
WorkflowDefinition → WorkflowVersion → WorkflowStep → WorkflowCondition → WorkflowInstance → WorkflowAction
```

**Version workflows.** If a definition changes while requests are in flight, those in-flight requests keep running against the version they started on — don't retroactively reassign them.

---

## 12. Internal Event-Driven Design

Modules shouldn't call each other's internals directly:

```
❌  leaveService → notificationService → auditService → employeeService → dashboardService
```

Emit domain events instead and let handlers subscribe:

```
LeaveApproved
   ├── Notification Handler
   ├── Audit Handler
   ├── Leave Balance Handler
   └── Analytics Handler
```

For guaranteed delivery, use the **Transactional Outbox Pattern**: the Mongo transaction that updates the leave record also inserts the outbox event, and a worker later processes `LeaveApproved` from the outbox. This avoids the "leave got approved but the notification job silently vanished" failure mode.

---

## 13. Notification Platform

```
Domain Event → Notification Policy → Template → Recipient Resolution → Notification Queue → Channel Adapter
```

Channel adapters: `InApp, Email, Push, SMS, WhatsApp`. Launch with in-app + browser push + SMTP email; SMS/WhatsApp require paid providers, so keep them as adapters a tenant (or you) can plug credentials into later rather than building them now.

Every notification should carry: template, variables, locale, priority, read/unread state, deep link, a deduplication key, delivery status, retry status, and channel preference.

---

## 14. Realtime Strategy

Don't reach for WebSockets everywhere — match the transport to the use case:

| Transport | Use for |
|---|---|
| REST | Normal HRMS CRUD operations |
| SSE | Notification stream, payroll progress, import/export progress, dashboard refresh |
| WebSocket / Socket.IO | Support chat, typing indicators, presence, bidirectional features |

Valkey Pub/Sub connects multiple API/realtime instances once you scale beyond one process.

---

## 15. Support System

```
Tenant → Support Ticket → Conversation → Messages → Attachments → Assignment → Priority → SLA → Resolution
```

The support panel should surface: tenant, plan, enabled modules, app version, recent errors, recent audit activity, ticket history, browser/device, and request/correlation ID — without ever requiring the customer's password.

If you add impersonation later, make it a first-class, constrained concept: reason required, auto-expiring, read-only by default, fully audited, with a persistent visible banner and sensitive actions blocked. Never silently become another user.

---

## 16. Provider Abstractions

Define ports for every piece of infrastructure the app depends on, so the application layer never imports a vendor SDK directly:

```ts
interface PaymentProvider { createOrder(); verifyPayment(); refund(); handleWebhook(); }
interface StorageProvider { put(); get(); delete(); createSignedUrl(); }
interface MailProvider   { send(); }
interface PushProvider   { send(); }
interface AttendanceProvider { syncEvents(); registerDevice(); verifyWebhook(); }
```

Application code depends on the interface; infrastructure implements it. Standard dependency inversion — but worth calling out explicitly because it's what makes swapping a payment gateway or biometric vendor a config change instead of a rewrite.

---

## 17. Biometric/Attendance Integration

Never couple attendance logic to one vendor. Normalize every punch into a single shape:

```ts
AttendanceEvent {
  tenantId, employeeId, externalEmployeeId, deviceId,
  source, timestamp, eventType, location, metadata
}
```

Sources: `WEB, MOBILE, BIOMETRIC, RFID, FACE_DEVICE, API, IMPORT, ADMIN`.

```
Biometric Vendor → Vendor Adapter → AttendanceEvent → Attendance Processor
```

The core attendance module never needs to know whether a punch came from a fingerprint scanner, RFID, mobile, or web.

---

## 18. MongoDB Data Access

Use the native driver, not Mongoose — keep domain logic out of ORM models. Repositories hide Mongo details behind an interface:

```ts
interface EmployeeRepository { findById(...); search(...); create(...); update(...); }
// implemented by: MongoEmployeeRepository
```

---

## 19. Pagination

Avoid `skip(N).limit(20)` on large collections — it degrades badly at depth. Use cursor/keyset pagination instead:

```ts
createdAt < lastCreatedAt AND _id < lastId
// index: { tenantId: 1, createdAt: -1, _id: -1 }
```

---

## 20. Avoiding N+1 Queries

```
❌  Get 100 employees, then per-employee: get department, get manager, get designation
    → up to 301 queries
```

Use aggregation pipelines, bulk lookups, cached master data, and batched queries with projected fields instead.

---

## 21. Caching Policy

**Cache:** sessions, effective permissions, effective entitlements, tenant configuration, feature flags, rate-limit counters, distributed locks, short-lived OTPs, dashboard snapshots, short-lived master data, queues, realtime pub/sub.

**Don't cache everything blindly** — MongoDB stays the single source of truth. On a fixed-RAM box, Valkey's memory efficiency matters more than it would on a dedicated cache tier.

---

## 22. Background Jobs

Move anything expensive or non-interactive off the request path: email, notifications, report generation, Excel export, PDF generation, bulk imports, attendance processing, payroll execution, document processing, webhooks, scheduled jobs, analytics, data cleanup.

```
POST /reports/export → 202 Accepted { jobId }
    worker produces the file
    SSE → export.completed
```

Far better than holding an HTTP connection open for 40 seconds.

---

## 23. Payroll Correctness

**Never use floating-point arithmetic for money.** Use integer minor units (₹25,000.75 → `2500075` paise) or Mongo `Decimal128` where true decimal behavior is required.

Payroll runs must be: deterministic, versioned, repeatable, auditable, idempotent. Each run should capture a full snapshot:

- employee snapshot
- salary structure version
- attendance snapshot
- leave snapshot
- tax/rule version
- component definitions
- calculation output
- approval history

Once finalized: **locked.** Don't silently recompute historical payroll because a salary was edited afterward.

---

## 24. Effective-Dated Configuration

HR data is inherently historical — never overwrite in place (`employee.salary = 40000`). Instead store `validFrom / validTo / version` for: salary, designation, department, manager, shift, leave policies, payroll rules, tax rules. This is what makes payroll and audit trails actually correct.

---

## 25. Frontend Architecture

Mirror the backend's module concept on the frontend:

```
web/src/modules/
  employee/  attendance/  leave/  payroll/  support/  ...
```

Each module contributes routes, navigation, commands, permissions, pages, and widgets. A `ModuleRegistry`, combined with the tenant's effective plan and permissions, builds navigation dynamically — no manually maintained sidebar.

For large tables, use TanStack Table with virtualization rather than rendering thousands of DOM rows; TanStack Query keeps server state cleanly separated from local UI state so data-fetching logic isn't reinvented per module.

---

## 26. Desktop vs. Mobile UI

Don't just shrink the desktop layout — design each surface for how it's actually used:

| Desktop | Mobile |
|---|---|
| Dense tables | Cards |
| Bulk actions | Bottom sheets |
| Filters + saved views | Drawers |
| Column selection | Sticky actions |
| Keyboard navigation | Compact filters |
| Split panels | Single-column flows |

---

## 27. Version Verification Note

Specific version numbers (Node 24 LTS, Fastify 5.x, React 19.x, MongoDB 8.x, Valkey 9.1.x) reflect the state of these projects as of the original research — worth a quick re-check against current release/LTS status right before you actually scaffold the project, rather than treating them as pinned facts.
