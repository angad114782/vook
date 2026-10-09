# Vook — Tasks & Roadmap

Legend: `[x]` done (present in frontend/mock) · `[ ]` pending · 🔌 needs real backend

## Phase 0 — Foundation
- [x] Vite + React 19 + TS strict, React Query, Zustand, Router 7
- [x] Mock data mode (MSW + IndexedDB) and API mode switch via `VITE_DATA_MODE`
- [x] OpenAPI v2 contract + generated types (`npm run generate:api`)
- [x] Route access map (`src/config/routeAccess.ts`)
- [x] Error boundary, skip-link, base design tokens
- [ ] CI pipeline: typecheck → lint → test → build → verify:api
- [ ] Environment config docs per stage (dev/staging/prod)

## Phase 1 — Real backend (Express + MongoDB) ✅ built in `server/`
- [x] Auth: cookie session, CSRF, lockout, scrypt, 2FA (TOTP), reset/invite links, session list/revoke
- [x] Tenancy, entitlements, RBAC + scopes, workflows, audit trail
- [x] Org, employees (CSV import), attendance (geofence), leave, approvals, holiday calendars, shifts
- [x] Payroll (maker–checker, immutable payslips, PDF), expenses, documents/files (content-checked uploads)
- [x] Plans (immutable versions), subscriptions, checkout (Razorpay port + dev stand-in), invoices, online registration → company provisioning (transactional)
- [x] Notifications, support tickets, Socket.IO live chat + live notifications, reports, search, platform settings, announcements
- [x] Integration tests per module, contract-coverage test against every frontend API call, real-browser smoke across all 7 roles
- [ ] Production hardening: Redis-backed rate limit/session cache for multi-instance, S3 storage adapter, SMTP/WhatsApp delivery workers, background jobs for exports
- [ ] Load test at 1,000 users on production-grade infrastructure (see `server/loadtest/run.mjs`)

## Phase 1b — Auth & tenancy (frontend)
- [x] Login / forgot / reset / invitation / verify email screens
- [x] Cookie session + CSRF header handling in axios client
- [ ] 🔌 Implement `/auth/*` endpoints (HttpOnly Secure cookie, refresh rotation)
- [ ] 🔌 2FA setup/verify end-to-end
- [ ] 🔌 Session list/revoke end-to-end
- [ ] Account lockout + rate-limit UX messages

## Phase 2 — SaaS control plane
- [x] Plans draft/publish UI, Subscriptions, Modules, Companies pages
- [ ] 🔌 `POST /plans/{id}/publish` creating immutable `PlanVersion`
- [ ] 🔌 Entitlement resolver (version + overrides) cached server-side
- [ ] Plan migration wizard (explicit, with preview of module diff)
- [ ] Entitlement override audit view

## Phase 3 — Core HR
- [x] Employees list/detail, departments, teams, designations
- [x] Attendance pages (HR / Manager / Supervisor / Employee)
- [x] Leave management & holiday calendar
- [x] Approvals inbox
- [ ] Bulk employee import with row-level error report 🔌
- [ ] Regularization approval actions end-to-end 🔌
- [ ] Shift roster drag-and-drop

## Phase 4 — Payroll & money
- [x] Salary structure, run payroll, payslips, compliance, reports pages
- [x] Checkout abstraction (Razorpay / PayU) with idempotency key
- [ ] 🔌 Payroll state machine: prepare → review → approve → finalize → publish
- [ ] 🔌 Payroll snapshot (employee, attendance, leave, rule version)
- [ ] 🔌 Payslip PDF generation worker
- [ ] 🔌 Webhook idempotency for payments
- [ ] Migrate any remaining float money fields to integer minor units

## Phase 5 — Platform
- [x] Notifications inbox & preferences, support pages, mock socket
- [ ] 🔌 Socket.IO gateway per `realtime-v2.md`
- [ ] 🔌 Integrations save/test/activate/disable
- [x] 🔌 Attendance devices: dynamic providers (face / fingerprint / both), mandatory API key + token per connection, public punch endpoint, per-company multi-device registry across branches, merged punches (earliest in / latest out)
- [ ] 🔌 Vendor-specific adapters that pull from a cloud API on a schedule (today devices push to Vook)
- [ ] Async report export (202 + jobId + progress event)
- [ ] Global search backend 🔌

## Phase 6 — Quality & hardening
- [x] Jittered retry backoff and jittered access polling (frontend)
- [ ] k6 load test: 1,000 virtual users, realistic role mix, 15 min — p95 < 500 ms, errors < 0.1%
- [ ] Spike (0→1,000 in 60 s), soak (2 h) and failure (DB/Redis/provider down) tests
- [ ] Replace access polling with realtime push (`access:changed` event)
- [ ] Bundle budget check in CI (< 250 KB gzipped initial JS per page)
- [ ] Rate limiting, backpressure and `429` friendly message end-to-end 🔌
- [ ] Background jobs for exports/imports/payslip PDFs (202 + jobId) 🔌
- [ ] Load-test dashboards and alerts (latency, errors, saturation, queue depth)
- [ ] Unit tests for permission/route-access logic
- [ ] Contract tests against real backend (`verify:api` in CI)
- [ ] Playwright E2E: login per role, apply leave, run payroll, checkout
- [ ] Accessibility audit (axe) on all portals
- [ ] Bundle analysis; route-level code splitting check
- [ ] Remove dormant mock code once backend is stable

## Phase 7 — Later
- [ ] Recruitment, Performance, Assets modules
- [ ] SMS / WhatsApp notification channels
- [ ] Impersonation (reason required, expiring, read-only, audited)
- [ ] Localisation (i18n) and multi-currency display

## Definition of Done
1. Typecheck, lint, tests, build pass.
2. Permission + entitlement checks covered (both allowed and denied).
3. Loading, empty, error, and offline states handled.
4. Audit event emitted for business-critical mutations.
5. Docs updated if contract or rule changed.

- [x] Whole-app theme pass (teal only) and one heading style across 36 pages; audited in real Chrome for all 95 pages of 7 roles
- [x] Pick-lists from the database with “+ Add new” and delete: document categories, expense categories, support topics, employment types, industries; full time-zone list
- [x] Leave types: add / delete from a “Leave types” panel on the Leave page (days a year can be set when adding; editing an existing type's days is not built yet)
- [ ] Shift planner: shift names and times are fixed (Morning / Evening / Night); make them the company's own shifts from `/shifts`
- [ ] Super Admin activity filters (modules) from the module catalogue
- [x] Attendance devices: platform ↔ company link (choose which companies get a brand, per-company usage, status banners, notifications, delete guard, “Ask Vook” tickets, setup guide)
- [ ] Per-company API credentials for machines (today one key and token per brand is shared by every company of that brand)
- [x] Deploy: one workflow ships frontend + API to the VPS (server checked first, site replaced last), pm2 process file, Nginx blocks, production-safe defaults, `create-admin` script (see deploy/README.md)
- [ ] Run the API test suite in CI (needs a MongoDB replica set service)
- [ ] Database backups and monitoring/alerts for the VPS
