# Backend handoff for API v2

## Source of truth

`openapi-v2.yaml` is the frontend contract. Generated declarations live in `src/contracts/generated.ts`. The moved server at `D:\Projects\vook\vti-backend` is legacy reference code and implements the old unversioned API, not this contract.

## Transport

- Base path: `/api/v2`.
- Successful JSON: `{ "data": <payload>, "meta": <optional metadata> }`.
- Errors: `{ "error": { "code": "STABLE_CODE", "message": "Human-readable message", "details": {}, "requestId": "..." } }`.
- List metadata: `{ "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }`.
- IDs are opaque strings; timestamps are ISO-8601 UTC; enums are uppercase.
- New money fields use integer minor units and an ISO currency code. Existing display models convert at the client boundary.
- Uploads use multipart form data. Downloads return raw bytes with `Content-Type` and `Content-Disposition`.

## Authentication and security

`POST /auth/login` sets an HttpOnly, Secure cookie and returns the user plus a CSRF token. `GET /auth/session` hydrates a reload. `POST /auth/refresh` rotates the session. `POST /auth/logout` revokes and clears it. The frontend sends credentials and `X-CSRF-Token` on unsafe requests.

Allow only the exact frontend CORS origin, enable credentials, expose `Content-Disposition`, and allow CSRF/idempotency headers. Tenant scope and role permissions are derived and validated server-side. A `companyId` filter is honored only for authorized Super Admins.

## Resource model

All roles share `/employees`, `/attendance`, `/leave-requests`, `/approvals`, `/expenses`, `/payslips`, and related resources. Authorization changes visible rows and operations, not route families. `src/api/routes.ts` temporarily translates older feature-client names to the v2 wire contract; a backend implements only v2 resource paths.

Plans are edited as drafts. `POST /plans/{id}/publish` creates an immutable numbered `PlanVersion`; subscriptions store `planVersionId` and do not follow later publications automatically. Migration is explicit. Effective entitlement is the pinned version plus active, auditable company overrides. Core modules cannot be removed.

Tenant authorization must evaluate in this order:

1. Authenticated session.
2. Active tenant and subscription state.
3. Effective module entitlement.
4. Permission action.
5. Assignment scope (company, branch, department, team, or self).
6. Business-policy and workflow-state rules.

Users may hold multiple role assignments. Permissions are unioned, but records must still match at least one assignment that grants the requested permission and covers that record. Permissions belonging to removed modules remain stored but dormant.

Payroll is prepared and reviewed by Finance, then authorized, finalized, and published by Company Admin. Published payslips are immutable. Salary records are effective-dated. Leave, attendance corrections, expenses, and payroll transitions must record actors, comments, timestamps, activity, and immutable audit entries.

## Checkout providers and idempotency

Razorpay and PayU sit behind the same checkout response. The frontend sends a stable idempotency key; retries must return the original order/result and webhook processing must be idempotent. API mode may return Razorpay order fields or a PayU `redirectUrl`. Mock mode never loads either provider SDK and simulates the result locally.

## Switching from demo to API

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://api.example.com/api/v2
VITE_REALTIME_URL=https://api.example.com
```

MSW, IndexedDB demo state, simulated checkout, and the in-memory realtime client remain dormant. They can later be removed without editing feature pages.

The two `x-mock-only` operations (`/demo/accounts` and `/demo/reset`) support local demo controls and are never called in API mode. A production backend does not implement them.
