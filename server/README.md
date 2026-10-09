# Vook API (Node.js · Express 5 · MongoDB)

Implements the `docs/openapi-v2.yaml` contract the React app uses. One API serves every portal; what a person sees is decided on the server by tenant → subscription → module → permission → scope.

## Run it

```bash
cd server
cp .env.example .env        # then put your own MongoDB connection string in MONGODB_URI
npm install
npm run seed -- --reset     # demo companies/users (password Demo@123) — development only
npm run dev                 # http://localhost:4000/api/v2   (health: /health, readiness: /ready)
```

Frontend (separate terminal, repo root) — create `.env.local`:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:4000/api/v2
VITE_REALTIME_URL=http://localhost:4000
```

then `npm run dev`. Demo logins: `superadmin@`, `companyadmin@`, `hr@`, `finance@`, `manager@`, `supervisor@`, `employee@` `demo.vook.app`.

## Configuration (`server/.env`, never committed)

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | Database (Atlas or local). A replica set is needed for transactions (Atlas always is). |
| `CORS_ORIGIN` | Exact frontend origin(s), comma separated. Cookies are sent only to these. |
| `COOKIE_SECURE` | `true` behind HTTPS (required in production). |
| `SESSION_TTL_HOURS` | Sliding session lifetime. |
| `SECRETS_KEY` | 32 random bytes, base64. Encrypts payment/SMTP credentials at rest. **Required in production** (`openssl rand -base64 32`). |
| `BOT_GUARD`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Bot protection (proof-of-work on by default; Turnstile optional). |
| `TRUST_PROXY` | How many reverse proxies sit in front (so the real client IP is used). |
| `SEED_DEMO` | Seed demo data when the database is empty. Keep `false` in production. |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | File storage (local disk behind a `StorageProvider` port) and size cap. |

## Signing in
Email or mobile number + password, or a 6-digit code sent to the mobile number on **WhatsApp** or **SMS**. Providers are set up by the platform admin under *Integrations* (WhatsApp Cloud API, Twilio SMS). In development nothing is really sent: the code is shown on screen in a "Test mode" box. Bot and IP protection details: `docs/SECURITY.md` §16. Demo logins: `admin@`, `cadmin@`, `hrc@`, `finc@`, `mgr@`, `sup@`, `emp@` `vook.com` (mobiles `+91 90000 00001/2` and `+91 90000 10001–10005`), password `Demo@123`.

## Layout

```
src/
  app.ts, index.ts        express app, server, graceful shutdown, hourly billing tick
  config/                 validated environment
  db/                     mongo client, repo helpers, tenant-first indexes
  domain/                 entitlements, permissions, scope, audit, payroll maths, billing, support
  middleware/             session+CSRF, central route gate, maintenance, errors
  modules/<area>/         auth · tenant · org · hr (attendance, leave) · finance (payroll, expenses) ·
                          files · platform (plans, rbac, billing) · engage (notifications, support, reports…)
  payments/               PaymentProvider port (Razorpay + dev stand-in)
  realtime/               Socket.IO gateway (support chat, live notifications)
  seed/                   demo data
test/                     supertest + socket.io integration tests (each file gets its own throw-away database)
```

## Guarantees (and where they live)

- **Tenant isolation** — `tenantId` is never read from a client; `companyIdFor(req)` derives it from the session (`lib/http.ts`). Every tenant collection index starts with `companyId`.
- **Authorization order** — `middleware/gate.ts`: role gate → subscription state → module entitlement → permission; then record scope in handlers (`domain/access.ts`).
- **Sessions** — random 256-bit token in an HttpOnly cookie, stored hashed; CSRF token on every unsafe request; account lockout; scrypt password hashing (off the event loop).
- **Money** — payslips are whole-rupee integers computed per component; runs store minor units; published payslips and plan versions are immutable; payroll needs a second person to approve.
- **Retries** — `Idempotency-Key` on employee create, leave request, expense, and checkout; webhooks are signature-verified and settle a payment exactly once.
- **Secrets** — provider credentials are AES-256-GCM encrypted and never returned by any endpoint.
- **Uploads** — extension allow-list **and** content check, size cap, served only to authorised people with `attachment` disposition.
- **Overload** — per-user rate limits answer `429` politely; every list is paginated and every query bounded.

## Tests

```bash
npm test          # ~60 integration tests; they create and drop their own database
npm run typecheck
```

## Verified so far

| Check | How | Result |
|---|---|---|
| Integration tests | `npm test` — one throw-away database per file | auth, org, HR, money, platform, engage (incl. live sockets), mail worker |
| Frontend ↔ API coverage | `test/contract.test.ts` extracts every `api.*()` call in the React app and requests it | every call has a route |
| Real browser, all 7 roles | `npm run test:e2e` (Chrome → React → API → MongoDB), visits every sidebar page | no API errors, no error screens |
| 1,000 signed-in users, human think-time | `npm run loadtest -- --local --users 1000 --seconds 45` | 26,221 requests · 0 errors · p95 3 ms |
| 1,000 users hammering with no pause | `… --think 0 --seconds 20` | 69,335 requests · 3,400 req/s · 0 errors · p95 385 ms |
| Dependencies | `npm audit` | 0 known vulnerabilities |

The load figures are one Node process on a laptop against a local in-memory MongoDB (the app's own cost). A hosted database adds its own latency and, on a free Atlas tier, hard operation-rate limits — size the database for production traffic and re-run the same script against it.

## Known limits (honest list)
- Rate limits, caches and the session lookup cache are in-process. Running several API instances needs a shared store (Redis/Valkey) for those — a small adapter change, not a redesign.
- Heavy actions (payroll for thousands of people, large imports) run inside the request. They are bounded and fast at the sizes tested, but a job queue is the next step for very large tenants.
- Emails are delivered by the SMTP worker once an SMTP integration is active; WhatsApp/SMS delivery is not built yet.
- Files live on local disk behind `StorageProvider`; use the S3/GCS adapter slot for multi-server deployments.

## One-click sign-in (this computer only)
Open http://localhost:5173/login: a “This computer only” box offers one button per role. It works only with `NODE_ENV=development`, from the same machine, on `localhost`. Turn it off with `DEV_QUICK_LOGIN=off`. See docs/SECURITY.md §18.
