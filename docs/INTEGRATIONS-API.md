# Vook — Integrations & API Reference

Source of truth: `docs/openapi-v2.yaml`. This file is a readable summary.

## 1. Transport
- Base: `/api/v2` · JSON · cookie auth + `X-CSRF-Token` on unsafe methods.
- Success: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code", "message", "details", "requestId" } }`
- List meta: `{ page, pageSize, total, totalPages }`
- Uploads: multipart · Downloads: raw bytes + `Content-Disposition`.
- Mutations that must be retry-safe: `Idempotency-Key` header.

## 2. Environment
```dotenv
VITE_DATA_MODE=mock|api
VITE_API_BASE_URL=https://api.example.com/api/v2
VITE_REALTIME_URL=https://api.example.com
```

## 3. REST endpoint groups
| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `GET /auth/session` · `POST /auth/refresh` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/accept-invitation` · `/auth/change-password` |
| Security | `/auth/security/sessions` (GET, DELETE `{id}`) · `/auth/security/revoke-all` · `/auth/2fa/status|setup|verify` |
| Access | `GET /access` · `/entitlements` · `/modules` · `/modules/companies` · `/modules/toggle` · `/modules/permissions` |
| Roles | `/role-permissions` · `/role-definitions[/{id}]` · `/role-assignments[/{id}]` |
| Tenant | `/company` · `/companies[/{id}]` · `/companies/options` · `/users[/{id}]` · `/users/{id}/revoke-sessions` |
| Org | `/departments[/{id}]` (GET, POST, PATCH, DELETE) · `/designations[/{id}]` (GET, POST, PATCH, DELETE) · `/teams` `/offices` `/reporting-lines` `/departments/summary` |
| Employees | `/employees[/{id}]` · `/employees/{id}/actions` · `/employees/{id}/account` · `POST /employees/import` |
| Attendance | `/attendance` · `/attendance/summary` · `/attendance/mine[/today|/check-in|/check-out]` · `/attendance-policy` · `/attendance-regularizations[/mine|/{id}/actions]` · `/shifts[/{id}]` |
| Leave | `/leave-requests[/mine|/{id}|/{id}/actions]` |
| Approvals | `/approvals[/{id}]` · `/workflows[/{type}]` |
| Payroll | `/salaries` · `/payroll-runs` · `/payroll-runs/{id}/review|approve|finalize|publish` · `/payslips[/mine]` · `/payslips/{id}/download|pay|recalculate` |
| Expenses & files | `/expenses[/mine|/{id}]` · `/files/receipts` · `/files/documents` · `/files/{id}` · `/documents[/mine|/{id}]` |
| Plans & billing | `/plans[/{id}]` · `/plans/{id}/publish|discard-draft` · `/plan-versions/{id}` · `/module-catalog` · `/subscriptions[/{id}/{action}]` · `/subscription` · `/subscription/checkout` · `/entitlement-overrides` |
| Payments | `/payments[/mine|/offline|/{id}]` · `/invoices` · `/invoices/{id}/download` |
| Onboarding | `/onboarding[/{stepKey}|/plans|/trial|/checkout|/verify-email]` |
| Notifications | `/notifications[/{id}/read|/read|/read-all|/preferences]` · `/broadcasts` |
| Support | `/support-tickets[/{id}|/{id}/comments]` |
| Reporting | `/reports/{kind}` · `/reports/{kind}/export` · `/activity-events` · `/audit-events` · `/dashboard` · `/search` |
| Integrations | `/integrations` · `/integrations/{providerKey}` · `/integrations/{providerKey}/{test|activate|disable}` |
| Attendance devices (platform admin) | `/attendance-providers[/{key}]` · `/attendance-integrations[/{id}]` · `/attendance-integrations/{id}/{test|activate|disable}` |
| Attendance devices (company) | `/attendance-devices[/{id}]` · `/attendance-devices/{id}/events` · `/attendance-verification-policy` |
| Device punches (public, key + token) | `POST /attendance-events/ingest` |
| Pick-lists | `GET/POST /lookups/{type}` · `DELETE /lookups/{type}/{value}` (types: `DOCUMENT_CATEGORY`, `EXPENSE_CATEGORY`, `SUPPORT_CATEGORY`, `EMPLOYMENT_TYPE`, `INDUSTRY`) |
| Profile/Settings | `/profile` · `/settings/platform` |
| Mock-only | `/demo/accounts` · `/demo/reset` (never implement in production) |

## 4. Authorization order (every request)
Session → tenant/subscription active → module entitlement → permission → assignment scope → business rule.

## 5. Third-party integrations

### 5.1 Integration lifecycle (`/integrations`)
```
NOT_CONFIGURED → DRAFT → (test) → ACTIVE ⇄ DISABLED      ERROR / UNAVAILABLE reported by provider health
```
Response shape:
```json
{
  "providerKey": "razorpay", "category": "PAYMENT", "displayName": "Razorpay",
  "available": true, "status": "ACTIVE",
  "publicFields": [{ "key": "keyId", "label": "Key ID", "required": true }],
  "secretFields": [{ "key": "keySecret", "label": "Key Secret", "required": true }],
  "publicConfig": { "keyId": "rzp_live_xxx" }, "secretConfigured": true,
  "pendingConfiguration": false, "lastTestedAt": "2026-10-08T10:00:00Z", "lastErrorCode": null
}
```
- `PUT /integrations/{providerKey}` body `{ publicConfig, secrets, reason? }` — secrets write-only.
- `POST .../test` — verifies credentials, updates `lastTestedAt`.
- `POST .../activate` / `.../disable` — body `{ reason }`, audited.

### 5.2 Payments (Razorpay / PayU)
`POST /subscription/checkout` with `Idempotency-Key` returns either:
- Razorpay: `{ orderId, amount, currency, keyId }` → open Razorpay modal, or
- PayU: `{ redirectUrl }` → browser redirect.
Webhook (server-side only) confirms payment; processing is idempotent. Amounts are minor units + ISO currency.

### 5.3 Attendance devices (face, fingerprint or both, any vendor)

**Three levels, each owned by the right person**

| Level | Who | What |
|---|---|---|
| Provider + connection (the one form) | Platform admin | `POST /attendance-integrations/quick`. Send `{ providerKey, secrets: { apiKey, apiToken } }` to add a key and token to a provider from the list (built in or added before), or `{ name, biometrics, secrets }` to create a new provider. Optional for unusual brands: `mode`, `fields` (extra settings, values in `publicConfig` keyed by the label) . Cloud and bridge setups are checked before anything is saved, so a wrong address saves nothing. The result is an already-active connection. The “Add a device provider” screen uses only this. |
| Provider | Platform admin | The catalogue of vendors. The list is plain database data. The brands that come with Vook (face-only, fingerprint-only and face+fingerprint terminals, ZKTeco, Suprema and others) are added once, the first time the list opens; after that any provider, built-in or not, can be edited or deleted (`DELETE /attendance-providers/{key}`), and a deleted one is never added back. A provider that still has connections cannot be deleted (`PROVIDER_IN_USE`). Add any vendor: name, how it connects (`CLOUD_API`, `LOCAL_BRIDGE`, `DEVICE_PUSH`, `MOBILE`), what it reads (`FACE`, `FINGERPRINT`, or both), extra settings. |
| Connection | Platform admin | One working setup of a provider: **API key and API token are mandatory** for every non-phone connection. Stored AES-256-GCM encrypted, only a SHA-256 hash and the last 4 key characters are kept for lookup; never returned by any API. A connection can only claim biometrics its provider supports. Flow: `DRAFT → test → TESTED → activate → ACTIVE ⇄ DISABLED`. Editing anything resets it to DRAFT so the latest details are always retested. |
| Device | Company admin / HR | Each physical machine a company owns: **serial number, model number (optional), place name** (for example “Main gate, ground floor”), optional branch, what it reads, and who may punch there. Unlimited per connection (or capped by the plan's `devices` limit). A serial belongs to exactly one company, so punches can never cross companies. |

**Who may punch where.** Each device has an access rule the company chooses:
- `ALL`: anyone in the company (default).
- `BRANCH`: only employees whose branch equals the device's branch (a branch is required).
- `SELECTED`: only the listed employees.

A punch from someone not allowed is refused with `DEVICE_NOT_ALLOWED_FOR_EMPLOYEE` (403) and a plain message such as “This device is only for staff of Pune. Please punch at your own branch.” Rules are edited with `PUT /attendance-devices/{id}` (`access`, `employeeIds`).

**Several devices in one company.** Register as many as needed, across branches. All punches merge into the same attendance row per employee per day: the earliest check-in and the latest check-out win, regardless of which machine or arrival order (offline machines may sync late). The page shows each device's last punch, punches today and a "Working / No punches in 24 h" badge, plus its last 20 punches.

**Sending punches** (what the machine or its installer calls)
```http
POST /api/v2/attendance-events/ingest
X-API-Key: <api key>
Authorization: Bearer <api token>
{ "deviceSerial": "SN-1001", "employeeCode": "NS-0006", "modality": "FACE",
  "eventType": "CHECK_IN", "occurredAt": "2026-10-09T03:31:00Z", "externalEventId": "evt-42" }
```
- The company and branch come from the registered device, never from the body (`companyCode` is an optional cross-check, mismatch = `COMPANY_MISMATCH`).
- `externalEventId` makes retries safe (`duplicate: true`). Time must be within 36 hours of now.
- Errors: `DEVICE_UNAUTHORIZED` 401 (same message for wrong key or token) · `CONNECTION_NOT_ACTIVE` 403 · `DEVICE_NOT_REGISTERED` 403 (unknown or switched-off serial) · `MODALITY_NOT_ENABLED` 422 (e.g. fingerprint sent to a face-only device) · `EMPLOYEE_NOT_FOUND` 404 · `RATE_LIMITED` 429 (60 failures / 15 min per IP; 1200 punches / min per connection).
- A punch for a payroll-locked month is stored but not applied (`applied:false, reason: PERIOD_LOCKED`).

`/attendance-verification-policy` controls geofence / device / selfie requirements per company. Companies only learn which methods are available (`availableBiometrics`), never any device setup.

### 5.4 Notification channels
`Domain event → Policy → Template → Recipients → Queue → Adapter`
Adapters: InApp, Email (SMTP), Push; SMS/WhatsApp pluggable later. Dedup key, retry status, deep link on every notification.

### 5.5 Storage, mail, push (ports)
```ts
PaymentProvider { createOrder; verifyPayment; refund; handleWebhook }
StorageProvider { put; get; delete; createSignedUrl }
MailProvider { send }   PushProvider { send }
AttendanceProvider { syncEvents; registerDevice; verifyWebhook }
```
Application code depends on interfaces only; vendors live in infrastructure adapters.

## 6. Realtime (Socket.IO at `/socket.io`)
One connection per tab, cookie-authenticated.

| Client → Server | Payload | Ack |
|---|---|---|
| `support:join` | `{ ticketId }` | `{ ok }` |
| `support:leave` | `{ ticketId }` | — |
| `support:comment` | `{ ticketId, body, clientMessageId }` | `{ ok, comment?, code?, message? }` |
| `support:typing` | `{ ticketId, isTyping }` | — |
| `support:read` | `{ ticketId }` | `{ ok }` |
| `support:delivered` | `{ ticketId, messageId }` | `{ ok }` |

| Server → Client | Payload |
|---|---|
| `notification:created` | Notification DTO |
| `support:comment` | Comment DTO |
| `support:read:cursor` / `support:delivered:cursor` | `{ ticketId, userId, messageId, at }` |
| `support:presence` | `{ ticketId, userId, online }` |
| `support:typing` | `{ ticketId, userId, name, isTyping }` |
| `support:ticket-updated` | `{ ticketId, status, priority, updatedAt }` |

On reconnect: rejoin visible rooms and refetch notifications.

## 7. Async jobs pattern
`POST /reports/{kind}/export` → `202 { jobId }` → worker builds file → SSE/Socket `export.completed` → download link.

## 8. Error codes (convention)
`UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `MODULE_NOT_ENTITLED` 403 · `NOT_FOUND` 404 · `VALIDATION_FAILED` 422 · `CONFLICT` 409 · `IDEMPOTENCY_REPLAY` 200 · `RATE_LIMITED` 429 · `INTERNAL` 500. Always include `requestId`.

## 9. Contract workflow
```bash
npm run generate:api   # regenerate src/contracts/generated.ts
npm run verify:api     # CI check that generated file matches the YAML
```
Backend implements **only v2 paths**. `src/api/routes.ts` temporarily maps legacy client names to v2.

## 10. Implementation notes (server/)
- **Idempotency:** `Idempotency-Key` is honoured on `POST /employees`, `POST /leave-requests/mine`, `POST /expenses/mine`, `POST /subscription/checkout`. Same key + same user returns the original response (24 h).
- **Payment webhook:** `POST /api/v2/webhooks/razorpay` (public, HMAC-SHA256 signature over the raw body). Events `payment.captured` / `order.paid` / `payment.failed` settle the payment once; unknown orders are ignored.
- **Checkout without gateway keys (development only):** a stand-in settles instantly so the whole sign-up → verify email → login flow can be tried locally. Production refuses (`PAYMENTS_NOT_CONFIGURED`) until an active Razorpay integration exists.
- **Emails:** queued in `mailOutbox`; in development the verification/reset link is printed in the server log and visible to the platform admin at `GET /api/v2/dev/mail-outbox`.
- **Sockets:** identity comes from the session cookie; the client never states who it is. Internal support notes are delivered to platform staff only.

## 11. Deleting list items (departments, designations, providers)
Every “choose or add new” dropdown can also delete: a small bin on each row asks “Delete …? Yes / No” first.
- `DELETE /departments/{id}` is refused with `DEPARTMENT_IN_USE` (409) while active employees belong to it, and `DELETE /designations/{id}` with `DESIGNATION_IN_USE` while employees hold the title. The message says how many people and what to do. Deleting a department only unlinks its designations; it never deletes people.
- `DELETE /attendance-providers/{key}` is refused with `PROVIDER_IN_USE` while it has connections.
- Needs the same permission as editing (`ORGANIZATION.EDIT`; platform admin for providers). Every delete is audit-logged.

## 12. Pick-lists in the database (`/lookups`)
Lists that people choose from are data, not code. `GET /lookups/{type}` returns `{ items, canManage }`. The usual choices are added once, the first time a list is opened, and after that an allowed person can add (`POST { value }`, same name in another spelling returns the existing one) or delete. Deleting is refused with `LIST_ITEM_IN_USE` (409) while records still use the entry. Lists belong to one company (the platform admin has its own), except `INDUSTRY`, which is shared. Who may change which list is decided on the server and sent back as `canManage`, so the screen shows “+ Add new” and the bin only to people who can use them. Employment type is now free text validated against the company's list rather than a fixed enum. Time zones come from the browser's full list.

## 13. How the platform admin and the company admin work together (attendance devices)

**Who owns what**

| Step | Platform admin (Super Admin) | Company admin / HR |
|---|---|---|
| 1. Offer a brand | Adds only the provider name + API key + token once (`POST /attendance-integrations/quick`) | – |
| 2. Choose who gets it | `PUT /attendance-integrations/{id}/availability`: all companies, or only chosen ones | Sees only the brands offered to their company |
| 3. Link machines | Sees per brand: companies, machines each, last punch | Registers each real machine: serial number, model number, place name, and who may punch there |
| 4. Machine sends punches | – | Installer sets address + key + token (asked from Vook) on the machine |
| 5. Changes | Turn a brand off, take it from a company, or delete it | Sees a banner and a red label on each affected machine, and gets a bell notification |
| 6. Help | Reads support tickets | “Ask Vook” buttons create a normal support ticket (key and token, or a brand that is not listed) |

**Rules that keep it safe**
- The API key and token never leave the platform admin's side; companies ask for them through a support ticket.
- A brand cannot be deleted while machines are linked (`CONNECTION_IN_USE`); turn it off instead. Turning it off, or taking it from a company, never deletes the company's machines: they show **Paused by Vook** / **Not available to you** / **Provider removed** and resume when the brand is back.
- Admins and HR of every affected company are notified on: brand turned off or on, access taken away, new brand offered.
- A punch from a machine whose company no longer has access is refused with `CONNECTION_NOT_AVAILABLE`.
- Every change is audit-logged on both sides.

Leave types are the same idea but live in the company's leave policy: `GET /leave-types`, `POST /leave-types { type, total? }` and `DELETE /leave-types/{type}` (company admin and HR only; a type already used in leave requests is refused with `LIST_ITEM_IN_USE`). The Leave page shows a “Leave types” panel to those two roles. Shifts (Morning / Evening / Night) are still fixed in the shift planner; see TASKS.
