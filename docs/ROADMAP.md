# Vook — Phase-wise Roadmap (2026 → 2030)

**Vision 2030:** one dynamic, AI-assisted people-and-finance platform where every company runs exactly the HR it needs — modules, plans, roles, workflows, fields, reports and languages are all configured by the customer, not by developers — and any task can be done by a first-time user without training.

Related: `PRD.md` · `TASKS.md` · `UX-AUDIT.md` · `COMPETITOR-ANALYSIS.md` · `SECURITY.md` · `INTEGRATIONS-API.md`

## Guiding principles
1. **User-friendly first** (every phase's exit criteria include the 10-second test — see `RULES.md`).
2. **Dynamic over hard-coded** — if a company might want to change it, it is configuration (stored per tenant, versioned, audited).
3. **Everything is a module, every module is a plan item** — features are always built; plans decide who sees them.
4. **API-first** — every UI action has an OpenAPI v2 endpoint; webhooks for every event.
5. **Secure, auditable, explainable** — especially AI.
6. **Measure** — each phase ships with success metrics.
7. **Stable under load** — 1,000 simultaneous users, no crashes, no visible slowdown (`RULES.md` → Scale & stability). Every phase's exit includes a load test.

## Stack decision (MERN)
- **M**ongoDB (shared DB, `tenantId` on every document, effective-dated history, transactional outbox).
- **E/N** Node.js 24 LTS API. Blueprint chose **Fastify 5** (Express-compatible plugin model, faster, schema-first). Decision needed: *Fastify (recommended)* vs plain *Express*. Everything below works with either.
- **R**eact 19 + Vite + TanStack Query (already built). TypeScript strict throughout.
- Support: Valkey/Redis (cache, queues, rate limits), BullMQ workers, Socket.IO/SSE, object storage, OpenTelemetry.

---

## Phase 0 — Foundation ✅ (done: frontend + mock)
Multi-portal React app, mock data mode, OpenAPI v2 contract, RBAC route access, plan versions, entitlements, checkout abstraction.
**Exit:** all portals run on mock data. ✔

## Phase 1 — Real backend core (MERN) · *target: +3 months*
- API v2 on Node: auth (cookie session, CSRF, refresh rotation), 2FA, sessions, invitations, password flows.
- Tenancy + `AuthorizationService` (session → tenant → entitlement → permission → scope → policy).
- MongoDB repositories, indexes (`tenantId` first), migrations, seed, backups.
- Companies, users, roles/assignments, org (departments, designations, teams, offices), employees (+ CSV import), audit log.
- Observability: structured logs, request IDs, metrics, health checks. CI/CD, staging.
**Exit:** frontend runs with `VITE_DATA_MODE=api`; contract tests green; zero cross-tenant leaks in tests; **k6 load test with 1,000 concurrent users: p95 < 500 ms, errors < 0.1%**; spike + soak + failure tests pass.

## Phase 2 — Core HR operations · *+3 months*
- Attendance (web/mobile/biometric adapter), regularization, shifts/rosters, geofence & selfie policy.
- Leave (types, accrual, carry-forward, holidays), approvals engine + **workflow builder v1**.
- Documents (upload, expiry alerts, e-acknowledge), employee lifecycle (onboarding/offboarding checklists).
- Notifications (in-app, email, push) + realtime (Socket.IO).
- UX backlog items 1–6 from `UX-AUDIT.md`.
**Exit:** a 100-employee company runs daily HR end-to-end; attendance → leave → approvals flow tested in E2E; **9 AM punch-in burst (1,000 punches in 60 s) handled without errors**.

## Phase 3 — Payroll, compliance, billing & customization · *+4 months*
- **Payroll engine**: integer money, effective-dated salary structures, snapshot per run, maker-checker, immutable payslips, PDF.
- **India statutory pack**: PF, ESI, PT (state-wise), TDS/Form 16, challans, bank advice files. Country packs as pluggable rule sets.
- **Plan builder (fully customizable plans)**: modules à la carte, seat tiers, usage meters (employees, storage, payslips, SMS), add-ons, trial rules, coupons, annual/monthly, custom contract price per company, GST invoicing, proration, dunning, self-serve upgrade/downgrade with preview. Razorpay/PayU live.
- **Dynamic configuration**: custom fields on every entity, custom forms, custom statuses, custom approval chains, tenant branding (logo, colors, domain).
- **Report builder** + scheduled reports + exports; analytics dashboards v1.
- **PWA/mobile**: install, offline punch queue, push.
- **i18n**: English + Hindi (then Marathi, Tamil, Telugu, Bengali…), RTL-ready.
- Inline-style → design tokens migration (enables white-label + dark mode).
**Exit:** first paying customers on real payroll; **payroll run for 5,000 employees completes in the background while 1,000 users keep working normally**; plan builder can create a plan with no code deploy; Hindi UI complete.

## Phase 4 — Full HR suite · *+5 months*
- Recruitment/ATS (jobs, pipeline, interviews, offers, e-sign), onboarding automation.
- Performance (goals/OKRs, review cycles, 360, 1:1s), skills matrix.
- Expenses v2, loans/advances, benefits, reimbursements, travel.
- Assets (allocation/returns), helpdesk (employee queries with SLA), announcements, org chart, polls/engagement.
- **Integrations marketplace**: Tally, Zoho Books, QuickBooks, Slack/Teams, WhatsApp, Google/Microsoft SSO (SAML/OIDC), SCIM, webhooks, public API keys with scopes.
**Exit:** feature parity with Keka/greytHR for SMEs; ≥ 10 integrations live.

## Phase 5 — AI-native (2028) · *+6 months*
- **Vook Assistant** (chat + voice): employees ask "my leave balance / download Jan payslip / apply leave tomorrow"; HR asks "who is absent today / attrition by dept".
- **Agents** with human approval: draft payroll checks, anomaly detection (duplicate bank accounts, salary spikes), auto-triage approvals, resume screening with explanations.
- Predictive analytics: attrition risk, absenteeism, headcount planning, payroll cost forecast.
- Skills graph + learning recommendations; LMS lite.
- **AI governance**: every AI action logged, explainable, human-in-loop for people decisions, bias tests, tenant opt-out, no training on customer data.
**Exit:** ≥ 40% of routine employee queries resolved without HR; AI audit trail reviewable by customers.

## Phase 6 — Platform & scale (2029) · *+6 months*
- Public developer platform (SDKs, sandbox, partner app store with revenue share).
- Multi-entity / group companies, consolidated reporting, cross-company transfers.
- Performance & scale: read replicas/sharding by tenant, regional data residency (India, SG, EU), SOC 2 / ISO 27001, DR drills (RPO 15 min / RTO 1 h).
- Extract hot modules (payroll, notifications) to services only if metrics demand.
**Exit:** 10,000+ tenants load-tested; compliance certifications obtained.

## Phase 7 — 2030 vision
- Global: multi-country payroll via partners, multi-currency, local labor-law packs, contractor/EOR partner integrations.
- Autonomous HR ops: agents handle routine cycles end-to-end under policies the customer sets.
- Wellbeing, workforce planning simulation ("what if we open a branch / change shifts"), pay-equity and compliance copilots.
- Fully white-label for resellers and HR consultancies.
**Exit:** international customers live; majority of routine HR work automated with audit.

---

## Feature catalog (all built; plans decide visibility)
| Domain | Modules |
|---|---|
| Core | Dashboard, Employees, Organization, Documents, Announcements |
| Time | Attendance, Shifts, Leave, Holidays, Overtime, Timesheets |
| Money | Payroll, Payslips, Compliance, Expenses, Loans, Benefits, Invoices |
| Talent | Recruitment, Onboarding, Performance, Skills, Learning |
| Operations | Assets, Helpdesk, Travel, Visitors |
| Control | Roles & scopes, Workflows, Custom fields, Audit, Reports builder |
| Platform | Integrations, API & webhooks, Branding, Languages, AI assistant |

## Plan customization model (per point of view)
| Viewpoint | What they can customize |
|---|---|
| **Platform owner (Super Admin)** | Define plans from modules + limits + prices; publish versions; create one-off contract plans; overrides; coupons; trials; regional pricing; feature flags/beta access |
| **Company admin** | Choose plan/add-ons, seats, billing cycle; enable/disable modules; roles, scopes, workflows, custom fields, branding, languages, notification rules |
| **HR / Finance** | Policies (leave, attendance, salary components, tax rules), templates (letters, payslips), approval chains |
| **Manager / Supervisor** | Team views, shift plans, approval delegation, notification preferences |
| **Employee** | Profile, language, notifications, dashboard widgets, privacy settings |
| **Developer / Partner** | API keys & scopes, webhooks, apps from the marketplace |

## Cross-cutting tracks (every phase)
- **UX:** usability test with 5 users per release; target ≥ 90% unaided task success.
- **Security:** threat model per module, pen-test before each major release.
- **Quality:** unit + contract + E2E + load tests; accessibility AA.
- **Docs:** user guides and in-app help written in plain language.

## Key risks
| Risk | Mitigation |
|---|---|
| Statutory payroll errors | Rule packs versioned, CA/consultant review, parallel runs with customers' existing payroll |
| Scope too large | Strict phase exits; ship modules behind flags; partner instead of build |
| AI trust/regulation | Human-in-loop, explainability, audit, opt-out |
| Single-VPS limits | Observability first; scale-out plan in Phase 6 |
| Slow adoption | Ease-of-use rule, guided setup, import from competitors' exports |

## Decisions needed from you
1. Fastify vs Express for the Node API.
2. Phase order: payroll before or after full HR suite? (Recommended: as above.)
3. Launch geography beyond India, and which languages first.
4. Pricing model: per-employee, module-based, or hybrid (recommended: hybrid via plan builder).
5. Data residency / hosting provider.
