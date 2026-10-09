# Vook — Engineering Rules

Condensed from `AGENTS.md — Production HRMS-ERP Engineering Rules.md`. That file remains the full reference.

## Priority order
**Correctness → Security/Data integrity → User-friendliness → Simplicity → Reliability & stability under load → Performance → Maintainability → Extensibility**

## User-friendly first (non-negotiable)
Users are HR, finance and floor staff — not engineers. If a first-time user has to guess, read a manual, or know a technical term, the feature is not done.

1. **Everything visible.** Never hide an action behind a trick (type-to-reveal, right-click, hover-only, keyboard-only). If an action exists, there is a visible button or link with a plain label — e.g. a dropdown always shows **+ Add new department** at the bottom.
2. **Plain words only.** No field names, codes, enums, formats or jargon in the UI (`joiningDate`, `YYYY-MM-DD`, `ORGANIZATION.CREATE`, `409`, "payload"). Say "Joining date", "15/01/2026", "You don't have permission to add departments".
3. **Fewest steps.** Prefer 1 click over 3. Never make the user leave the screen to create something they need right now (create inline, then keep their place and their typed data).
4. **Tell, don't make them find out.** Every screen answers: what is this, what can I do, what happens next. Add short helper text, numbered steps for multi-step tasks, and a clear empty state ("No departments yet — add your first one").
5. **Errors say what to do.** "Mobile number should have 10 digits" — not "validation failed". Name the row/field, say how to fix it. Never show raw server messages or codes.
6. **Safe by default.** Preview before bulk changes, confirm before destructive ones, allow cancel/undo, never lose typed input on error.
7. **Forgiving input.** Accept the formats people really type (15/01/2026, 98765 43210, ₹12,00,000, any letter case); normalise them for the user instead of rejecting.
8. **Match what they already know.** Excel/Google Sheets language for imports, familiar patterns (normal-looking dropdowns, big obvious primary button). Use the same label for the same thing everywhere.
9. **Permissions explained.** If something is unavailable, say why and who can help ("Ask your admin to add a department") instead of silently hiding it.
10. **The 10-second test.** Before finishing any UI, ask: *could a new HR assistant do this without help?* If not, simplify.

**Review checklist for any UI change:** visible action ✔ plain words ✔ empty state ✔ helpful error ✔ preview/confirm ✔ works on mobile ✔

## Scale & stability: 1,000+ simultaneous users (non-negotiable)
Target: **1,000 users online at the same time** (and bursts like 9 AM punch-in / payroll day) with **no crashes and no slowdowns users can notice**. Design for 10× that.

**Budgets (must hold under a 1,000-user load test)**
| Measure | Target |
|---|---|
| Page/API p95 latency | < 500 ms (p99 < 1.5 s) |
| Error rate | < 0.1% |
| Server CPU / memory at peak | < 70% (headroom for spikes) |
| Initial JS per page | < 250 KB gzipped (rest lazy-loaded) |

**Backend**
1. Nothing unbounded: every list is paginated (cursor/keyset), every query has limit + timeout, every payload and upload has a size cap.
2. No N+1 queries; project only needed fields; every query has a `tenantId`-first index (check with `explain`).
3. Heavy work (payroll, exports, PDFs, imports, emails, reports) runs in **background jobs**; the API answers `202 { jobId }` and reports progress.
4. Cache expensive read-heavy data (permissions, entitlements, config, dashboards) with TTL + correct invalidation; protect hot keys from stampedes.
5. Rate-limit per user/tenant/IP; add concurrency limits and backpressure so overload returns a polite `429`/"try again in a moment", never a crash.
6. Timeouts + circuit breakers on every external call (payments, SMS, biometrics); one slow provider must not slow everyone.
7. Idempotency for retries; bounded retries with exponential backoff **and jitter**.
8. Connection pools sized and monitored; no leaks; graceful shutdown; health/readiness checks; horizontal scaling ready (stateless API, shared Redis/Valkey).
9. Degrade gracefully: if realtime, search or analytics fail, the core screen still works.
10. Large writes (bulk import, payroll run) are chunked and transactional per chunk.

**Frontend**
0. **Loading = skeleton, never a bare spinner.** While data is slow, show YouTube/Instagram-style grey shimmer placeholders shaped like the real content (`components/ui/Skeleton.tsx`: `PageSkeleton`, `DashboardSkeleton`, `TableSkeleton`, `ListSkeleton`, `CardGridSkeleton`, `FormSkeleton`). Keep the layout stable (no jumping). Small spinners are only for buttons that are saving. Slow for >10 s or failed → show a friendly message with Retry.
1. Route-level code splitting; lazy-load heavy libraries (charts, Excel, PDF).
2. Server state through TanStack Query with sensible `staleTime`; never fetch the same data twice on one screen.
3. Polling is a last resort — prefer realtime push; any poll must be slow, **jittered**, and paused in background tabs.
4. Retries use backoff with jitter; no tight loops.
5. Debounce search (≥ 300 ms), cancel stale requests, paginate/virtualize big tables (> 100 rows).
6. Cache static assets with hashed filenames behind a CDN; compress (gzip/brotli); images sized and lazy.
7. Never block the main thread on big files (parse CSV/Excel in chunks or a worker; cap file size/rows).

**Proof before "done"**
- Load test (k6) with a realistic mix of 1,000 virtual users for 15 min: budgets above hold, no errors, no memory growth.
- Spike test (0 → 1,000 users in 60 s) and soak test (2 h).
- Failure test: kill DB/Redis/provider — app degrades gracefully and recovers on its own.
- Add the test to CI (smoke version) and run the full one before each release.
- Dashboards + alerts on latency, errors, saturation, queue depth, DB latency.

## Workflow for every task
Inspect → understand → find root cause → smallest safe change → implement → test → measure → review.
Flag before any breaking API / schema / auth / security / architecture change.

## Code rules
- SOLID, KISS, DRY, YAGNI, separation of concerns, fail-fast.
- Small single-purpose modules; no god components/services; no magic values.
- Reuse existing utilities/components first; abstract only after proven repetition.
- Business logic separate from UI/HTTP; external services behind adapters.
- Strong typing; no `any` unless justified in a comment explaining *why*.
- Comments explain why, not what.
- Never silently swallow errors.

## Frontend rules
- Pages never check `VITE_DATA_MODE`; only `src/api` / `config/runtime` do.
- All endpoints go through `src/api` and the typed v2 contract; run `npm run verify:api` after contract changes.
- Query keys only from `src/lib/queryKeys.ts`.
- Access gating via `routeAccess.ts` + entitlements; never `if (role === 'x')`.
- Money: integer minor units + currency; no float arithmetic.
- Lists: paginate/virtualize; never render unbounded rows.
- Every async view handles loading / empty / error / forbidden.
- No PII, tokens or payroll data in `console.*`, URLs, or analytics.
- Keep features in their portal folder; shared code in `components/` or `lib/`.

## API contract rules
- Base `/api/v2`; envelope `{ data, meta }` / `{ error }`.
- Retry-sensitive mutations carry an `Idempotency-Key`.
- Retries only for transient + idempotent calls, with backoff + jitter.
- Timeouts and request cancellation on all calls.
- Pagination/filter/sort limits are enforced.

## Data rules
- HR data is **effective-dated** — never overwrite salary, designation, manager, shift, policy in place.
- Finalized payroll is locked; never recompute history.
- Published payslips are immutable.
- Plans publish as immutable versions; subscriptions pin a version.

## Quality gates (before "done")
```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run verify:api        # if contract touched
npm run test:e2e          # if flow touched
```
- Add/update tests for changed behavior (unit, contract, E2E, regression).
- Check error and edge cases; confirm no security or performance regression.
- Benchmark before/after for performance work.

## Git rules
- Small focused commits, imperative messages.
- No secrets, `.env`, `node_modules`, `dist` committed.
- Deployment automation does not live in this repo.

## Final report format
1. Root cause / issue
2. Important changes
3. Verification / tests
4. Measurable performance change (if any)
5. Remaining risks / tradeoffs

- **Lists are data, not code.** Anything a person picks from (providers, departments, designations) comes from the database, can be added inline, and can be deleted by someone allowed to, with a clear refusal when it is still in use. No fixed lists hidden in the code that cannot be changed.
- **One dropdown component for every extendable list.** Use `CreatableSelect` (or `LookupSelect` for database lists). It shows “+ Add new …” and, for people allowed to, a small bin with an in-row “Yes, delete / No”. Do not hand-write `<select>` with a fixed array for business data such as categories, types or industries. Fixed arrays are only fine for system states (Open / Resolved, Pending / Approved), months, and similar.
- **One look.** Brand teal `#0d7470` (dark `#0d4a47`, tint `#dff3f1`), page title 22px bold dark teal. No indigo, blue, purple or pink accents; avatars, chips and charts use the teal family plus amber for warnings. Check a page with the colour audit before shipping.
