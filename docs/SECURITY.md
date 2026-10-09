# Vook — Security Model

HRMS data (identity, payroll, bank, documents) is highly sensitive. Principle: **least privilege, zero trust, server is authoritative.** The frontend only hides; it never protects.

## 1. Authentication
- `POST /auth/login` sets an **HttpOnly, Secure, SameSite** session cookie and returns user + CSRF token. No tokens in `localStorage`.
- `GET /auth/session` hydrates on reload; `POST /auth/refresh` rotates; `POST /auth/logout` revokes + clears.
- Password rules enforced server-side; breached/weak password rejection; reset tokens single-use, short-lived.
- 2FA (TOTP) via `/auth/2fa/*`; mandatory option for admins and Finance.
- Session list and revoke (`/auth/security/sessions`, `revoke-all`, `/users/{id}/revoke-sessions`).
- Brute-force protection: rate limits + progressive lockout, generic error messages (no user enumeration).

## 2. Authorization (evaluated in order, server-side)
1. Authenticated session
2. Active tenant & subscription state
3. Effective module entitlement
4. Permission action
5. Assignment scope (company / branch / department / team / self)
6. Business policy & workflow state

- Multiple role assignments: permissions are unioned, but the **record must match an assignment that grants that permission**.
- Permissions of removed modules stay stored but dormant.
- Super Admin `companyId` filter is honored **only** for Super Admins.

## 3. Tenant isolation
- `tenantId` is resolved from session → membership → active tenant. **Never** accepted from client body/query.
- Every tenant document carries `tenantId`; every index starts with it.
- Repositories inject tenant filter automatically; no raw DB access from controllers.
- Prevent IDOR: look up by `(tenantId, id)`, never `id` alone.
- Prevent mass-assignment: explicit allow-listed DTO fields.

## 4. Browser / transport
- HTTPS only, HSTS.
- CORS: exact frontend origin, credentials on, expose `Content-Disposition`, allow `X-CSRF-Token` and `Idempotency-Key`.
- CSRF: `X-CSRF-Token` required on unsafe methods.
- Headers: strict CSP (self + payment provider domains), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.
- No `dangerouslySetInnerHTML` with user content; sanitize rich text.
- Downloads served with `Content-Disposition`; uploads validated by type/size/magic bytes and virus-scanned.

## 5. Data protection
- Secrets only via environment / secret manager. Integration secrets are **write-only** (API returns `secretConfigured: boolean`, never the value).
- Encrypt sensitive fields at rest (bank, national IDs, salary); TLS in transit.
- Money as integer minor units (no float rounding exploits).
- Signed, expiring URLs for files and payslips.
- Never log passwords, tokens, payroll, or personal data. Logs carry `requestId`, not PII.
- Demo data (IndexedDB) exists only in mock mode and must never contain real data.

## 6. Payments
- Razorpay/PayU secrets stay server-side; frontend gets order fields or `redirectUrl` only.
- Idempotency key on checkout; webhook signature verified; webhook handler idempotent.
- Amount, currency and plan taken from the server, never trusted from the client.

## 7. Payroll integrity
- Maker–checker: Finance prepares/reviews, Company Admin authorizes/finalizes/publishes.
- Finalized runs locked; published payslips immutable.
- Each transition records actor, comment, timestamp and an immutable audit entry.

## 8. Audit & monitoring
- Immutable `/audit-events` for: login/2FA changes, role/permission changes, plan/entitlement overrides, payroll transitions, salary changes, integration changes, data export, impersonation.
- Alerts on: repeated failed logins, privilege change, bulk export, webhook signature failures.

## 9. Realtime
- Socket.IO authenticated by session cookie; tenant + identity derived server-side.
- Reject joins to rooms the user cannot access; ignore client-supplied tenant/author.
- `clientMessageId` makes comment submit idempotent.

## 10. Integrations
- Config split into `publicFields` and `secretFields`; secrets encrypted at rest.
- `test` before `activate`; `activate` / `disable` require a `reason` and are audited.
- Outbound calls: timeouts, bounded retries, circuit breaker, allow-listed hosts (SSRF protection).
- Inbound webhooks: HMAC signature + timestamp window + replay protection.

## 11. Impersonation (future)
Reason required · auto-expiring · read-only by default · persistent banner · sensitive actions blocked · fully audited.

## 12. Dependency & build hygiene
- `npm audit` in CI; pin via lockfile; minimal dependencies.
- No secrets in repo or bundle (`VITE_*` vars are public by definition).
- Source maps not exposed publicly in production.

## 13. Security checklist for every PR
- [ ] New endpoint enforces auth + permission + scope + tenant
- [ ] Input validated; output DTO allow-listed
- [ ] No sensitive data in logs/URLs/localStorage
- [ ] Audit event for critical mutation
- [ ] Rate limit / idempotency considered
- [ ] Tests for denied path (wrong role, wrong tenant, expired module)

## 14. Incident response (summary)
Detect → contain (revoke sessions, disable integration/tenant) → assess scope via audit + requestId → notify as required → remediate → post-mortem.

## 15. Implemented in `server/` (verified by tests)
- HttpOnly session cookie (token stored hashed), CSRF token on every unsafe request, lockout after 5 wrong passwords, scrypt hashing, generic login/forgot-password answers (no account enumeration).
- Tenant derived from the session only; list queries are scope-filtered in the database; cross-tenant ids return 404/403.
- Central gate: role → subscription state → module entitlement → permission, then record scope; maker–checker on payroll; no self-approval on leave, expenses, regularizations.
- Mass-assignment blocked by allow-listed zod schemas on every write; secrets are AES-256-GCM encrypted and never returned; uploads checked by extension *and* content; CSV exports neutralise spreadsheet formulas.
- Security headers (helmet), exact-origin CORS, per-user rate limits with a polite `429`, request IDs on every response and error, structured logs with secrets redacted.
- Payment webhooks: HMAC signature over the raw body, idempotent settlement. Provisioning a paid company runs in one database transaction.

## 16. Sign-in methods and attack protection (implemented)
**Ways to sign in:** email + password · mobile + password · mobile + one-time code on WhatsApp or SMS (provider chosen from the active integrations; codes are 6 digits, valid 5 minutes, five guesses, single use, stored only as a keyed hash).

**Against guessing and abuse**
- Every sign-in route first checks the platform's *blocked networks* list, then any temporary block on the caller's IP.
- 20 failures from one address in 15 minutes blocks it for 30 minutes (repeat offenders: 4 h, then 24 h). Failures are counted in MongoDB, so they hold across servers and restarts.
- Per account: lockout after 5 wrong passwords; 15 attempts per account per 15 minutes from anywhere.
- OTP: same limits for every number (so it cannot reveal who has an account or be used to pump SMS to strangers): 5 codes/hour per number, 30 s cool-down, 15 requests/hour per IP, messages only sent to registered numbers.
- Platform admins can be limited to approved networks; saving a list that excludes your own address is refused.
- Password-reset emails: 3 per address per hour. All answers are identical whether or not the account exists.

**Against bots:** an invisible proof-of-work puzzle (single-use, 2-minute lifetime, HMAC-signed, harder for addresses that keep failing) on sign-in, code request, password reset and sign-up; a hidden honeypot field; optional Cloudflare Turnstile (`TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY`). Switch with `BOT_GUARD=auto|on|off`.

**Responses** to sign-in routes are `Cache-Control: no-store`; the client IP is read through `TRUST_PROXY` hops so spoofed headers cannot choose it.

## 17. Attendance device credentials (implemented)
- Every device connection needs an **API key and API token**; both are stored AES-256-GCM encrypted, compared by SHA-256 hash with a constant-time check, and never returned (the screen shows only `••••` + last 4 characters, and the pair is displayed once when created).
- Only the platform admin can create providers or connections. Company admins and HR can only register their own devices; employees, managers and finance get `403`.
- A device serial belongs to one company; punches take the company from the device, so one company's machine can never write another company's attendance. Wrong key or token returns the same message, failures are throttled per IP, and punches are rate-limited per connection.
- Cloud connections must use `https://`; outbound tests block private/loopback addresses (SSRF) in production.
- Every create, edit, test, activation, registration and removal is audit-logged.
- Each device carries an access rule (everyone / own branch / chosen people), enforced on the server for every punch, so a person cannot attend through a machine they are not allowed on.

## 18. One-click sign-in for local development
`GET /auth/dev-accounts` and `POST /auth/dev-login { role }` let a developer enter as a sample person without a password. They exist **only** when all of these are true, otherwise they answer `404` as if they did not exist: `NODE_ENV=development`, `DEV_QUICK_LOGIN` is not `off`, the TCP connection really comes from this computer (loopback address, read from the socket, not from headers), no proxy or tunnel headers (`X-Forwarded-*`, `Forwarded`, `X-Real-IP`) are present, and the `Host` is exactly `localhost`, `127.0.0.1` or `::1`. The login page shows the buttons only when it is itself open on localhost in a dev build. Tested both ways; there is nothing to switch off in production because the code path is closed there. Never set `NODE_ENV=development` on a public server.

## 19. Production safety defaults
- **No demo data in production.** `SEED_DEMO` is off unless explicitly turned on, so an empty production database never gets the `Demo@123` accounts. The first real admin is created with `npm run create-admin` (password read from `ADMIN_PASSWORD`, at least 12 characters with letters and a number, never from the command line).
- **Reachable only through Nginx.** Set `HOST=127.0.0.1`; the API then cannot be called directly, so a caller cannot forge the `X-Forwarded-For` header the sign-in protections rely on.
- **Secrets only on the server.** `/etc/vook/server.env` (mode 640) holds the database address and `SECRETS_KEY`; nothing secret is in git or in the GitHub workflow. The workflow refuses to deploy if `SECRETS_KEY` or `MONGODB_URI` is missing.
- **The site is replaced last.** The deploy checks the server, restarts the API and waits for `/ready` before it replaces the website files, so a failed API deploy never leaves visitors on a broken page.
- The API runs under pm2 from `/etc/vook/server.env` (mode 600), a single copy, and restarts itself if it crashes.
