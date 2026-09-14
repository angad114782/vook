# AGENTS.md

## Goal
Build a production-grade HRMS/ERP that is correct, secure, fast, observable, maintainable, modular, reusable and easy to evolve. Optimize for **simplicity + measured performance**, not complexity.

## Core Rules
Follow **SOLID, KISS, DRY, YAGNI, SoC, high cohesion/low coupling, explicit dependencies and fail-fast design**.

- Prefer simple, readable, predictable code.
- Small functions/modules with one responsibility.
- Reuse existing utilities/components before creating new ones.
- Abstract/genericize only proven repeated concepts; avoid premature abstraction.
- Avoid god services/controllers, deep nesting, magic values, hidden state and duplication.
- Use clear domain naming, strong typing/contracts and consistent conventions.
- Keep business/domain logic separate from HTTP/UI/DB/external integrations.
- Prefer composition + DI over tight coupling.
- Design integrations behind interfaces/adapters so providers can be replaced.

## Before Changing Code
1. Inspect existing architecture, conventions, dependencies and call/data flow.
2. Identify **root cause**, not symptoms.
3. Prefer the **smallest high-impact safe change**.
4. Preserve behavior/API/schema unless change is required.
5. Consider edge cases, failure paths, concurrency and backwards compatibility.

Never rewrite working architecture merely to apply a pattern.

## Performance
**Measure → isolate → optimize → benchmark. Never guess.**

For slow APIs inspect:
`route → middleware → service → DB queries → external I/O → serialization → CPU/memory`

Check:
- p50/p95/p99 latency, throughput and error rate.
- N+1/repeated/duplicate queries.
- Query execution plans + missing/unused indexes.
- Over-fetching; select/project only required fields.
- Pagination/cursor for large collections.
- DB round trips, joins/aggregations and transaction duration.
- Sequential independent I/O → safe bounded concurrency.
- Blocking I/O → async I/O.
- CPU complexity, loops, allocations and unnecessary transformations.
- Connection pooling and resource leaks.
- Batch operations where appropriate.
- Compression/streaming for large responses.
- Cache only expensive/read-heavy data with TTL + correct invalidation.
- Move slow non-request-critical work to background jobs/queues.
- Prevent unbounded queries, loops, concurrency, payloads and memory usage.

Optimize algorithms/data structures where measurable; avoid premature micro-optimization.

## API & Reliability
APIs must have:
- consistent contracts/status/errors;
- validation/sanitization;
- pagination/filter/sort limits;
- timeouts and cancellation;
- rate/concurrency limits where needed;
- idempotency for retry-sensitive mutations;
- bounded retries only for transient/idempotent failures using backoff+jitter;
- circuit-breaker/degradation where dependency failures justify it.

Never silently swallow errors.

## Data
Maintain integrity through:
- constraints/validation;
- correct indexes;
- atomic operations/transactions where required;
- concurrency/race-condition handling;
- idempotency;
- safe migrations + rollback strategy.

Avoid unnecessary transactions and long locks.

## Security — HRMS Critical
Apply least privilege and zero-trust boundaries:
- authentication + server-side authorization/RBAC;
- tenant/company data isolation;
- prevent IDOR/injection/mass-assignment;
- validate every untrusted input;
- secrets only via environment/secret manager;
- encrypt sensitive data appropriately;
- audit security/business-critical actions;
- never expose/log passwords, tokens, payroll, personal or sensitive employee data unnecessarily.

## Observability
Critical flows must be diagnosable using:
- structured logs;
- request/correlation/trace ID;
- metrics;
- traces where useful.

Track at minimum:
`latency | traffic | errors | saturation | DB latency/query count | cache/dependency health`

Log useful context, not noise or PII. Alerts must be actionable.

## Testing & Quality
For changed behavior add/update appropriate:
`unit | integration | API/contract | E2E | regression | performance`

Before completion:
- lint/type-check/build;
- run relevant tests;
- verify error/edge cases;
- ensure no security/performance regression;
- benchmark before/after performance changes.

## Maintainability
- Prefer feature/domain modules over scattered logic.
- Remove dead code only when proven safe.
- Avoid unnecessary dependencies; reuse maintained libraries.
- Centralize configuration/constants/common infrastructure.
- Keep comments for **why**, not obvious **what**.
- Keep changes focused and reviewable.

## Agent Execution Rule
For every task:

**Inspect → understand → root cause → design smallest safe solution → implement → test → measure → review.**

Priority:

**Correctness → Security/Data Integrity → Simplicity → Reliability → Performance → Maintainability → Extensibility**

Do not sacrifice correctness or maintainability for theoretical performance.

When finished, report only:
1. root cause / issue;
2. important changes;
3. verification/tests;
4. measurable performance change if applicable;
5. remaining risks/tradeoffs.

Flag before making breaking API/schema/auth/security/architecture changes.