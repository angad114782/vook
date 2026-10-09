# Vook — Design & Architecture

## 1. Design principles
- Calm, dense, professional — a work tool, not a marketing page.
- Consistency over novelty: one token set, one primitive set.
- Every screen has loading, empty, error, and no-permission states.
- Desktop and mobile are designed separately, not shrunk.

## 2. Design tokens (`src/index.css`)
| Token | Value | Use |
|---|---|---|
| `--vook-950 / 900` | `#0d4a47` | Brand dark, skip-link, headers |
| `--vook-700` | `#0d7470` | Primary buttons, focus, links |
| `--vook-100` | `#dff3f1` | Soft brand surface |
| `--surface` | `#ffffff` | Cards |
| `--canvas` | `#f8fafc` | Page background |
| `--line` | `#e2e8f0` | Borders |
| `--text` / `--muted` | `#0f172a` / `#64748b` | Text |
| `--success/warning/danger-*` | surface + text pairs | Status |
| Radius | 8 / 12 / 16 px | sm / md / lg |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 | `--space-1..6` |

Type: page title 20/700, card title 15/700, body 13, table header 11 uppercase.

## 3. Component primitives
- `src/components/ui/*` — Dialog, Drawer, Responsive primitives (Radix + vaul).
- Classes: `.admin-page`, `.admin-card`, `.admin-button(--secondary|--danger)`, `.admin-input`, `.admin-search`, `.org-table`, `.empty-state`, `.plan-card`.
- Reuse before creating; add a new primitive only after 3 repeated uses.

## 4. Layout & responsiveness
| Desktop | Mobile |
|---|---|
| Sidebar + dense tables | Bottom nav / drawer, cards |
| Bulk actions, saved filters | Bottom sheets, compact filters |
| Split panels | Single-column flows, sticky primary action |

Min touch target 38–44px. Large tables must be virtualized/paginated.

## 5. Navigation model
- Sidebar is built from **route access rules + tenant entitlements + user permissions** (`routeAccess.ts`), never hand-maintained per role.
- Recovery routes (`plan`, `account-security`, `support`) stay reachable when a subscription is blocked.

## 6. Application architecture
```
src/
  api/        thin clients per resource; routes.ts maps to v2 wire paths
  contracts/  generated OpenAPI types
  config/     runtime (mock|api), routeAccess
  store/      authStore (Zustand) — client-only state
  lib/        queryClient, queryKeys
  mocks/      MSW handlers + IndexedDB demo state
  realtime/   socket client + mock socket
  payments/   checkout abstraction (Razorpay/PayU)
  pages/<portal>/  one folder per role portal
  components/ shared UI
```
- **Server state** → TanStack Query (central `queryKeys`).
- **Client state** → Zustand only when needed.
- **Data source switch** → `VITE_DATA_MODE`; pages never branch on it.

## 7. Key flows
**Access check (client mirror of server):** session → tenant active → module entitled → permission → scope → business rule. The server is authoritative; the UI only hides.

**Payroll:** Finance prepare → Finance review → Admin approve → finalize (locked) → publish (immutable payslips).

**Plan:** Draft → publish → `PlanVersion n` → subscription pins version → explicit migration.

**Checkout:** stable idempotency key → create order → Razorpay modal or PayU redirect → webhook confirms → UI polls/refetches.

## 8. UX standards
**Plain-language, everything-visible UI is mandatory** (full rules in `RULES.md` → "User-friendly first").

### Pattern: select with inline "Add new"
Looks like a normal dropdown. The list always ends with a visible **+ Add new <thing>** button; clicking it shows a one-line name box with **Add / Cancel**, then selects the new item. Used for Department and Designation (`CreatableSelect`). Users without permission see "Ask your admin to add one" instead of nothing.

### Pattern: bulk import
Numbered steps (download sample → fill in Excel/Sheets → save as CSV → upload) → preview → plain-language list of rows to fix → "Add N employees". Column titles in the sample are human ("Full Name", "Mobile Number"); dates like 15/01/2026 and amounts like ₹12,00,000 are accepted.

### Pattern: loading (skeleton)
Slow network or slow API → grey shimmer blocks in the exact shape of the page (like YouTube/Instagram). Use `PageSkeleton` / `DashboardSkeleton` for whole pages, `TableSkeleton` / `ListSkeleton` / `CardGridSkeleton` / `FormSkeleton` for sections. Announced once to screen readers; shimmer stops for users who prefer reduced motion. Buttons that are saving keep a small inline spinner.

### General
- Destructive actions: confirm dialog with reason when audited.
- Forms: inline validation, disabled-while-submitting, preserve input on error.
- Toasts (Sonner) for outcomes; persistent banners for blocking states.
- Dates ISO UTC on wire, local display; currency formatted from minor units.
- Accessibility: visible focus, labelled inputs, color never the only signal, dialogs trap focus.

## 9. Data conventions
- Success `{ data, meta }`, error `{ error: { code, message, details, requestId } }`.
- IDs opaque strings, enums UPPERCASE, lists paginated `{ page, pageSize, total, totalPages }`.

## Choose-or-add dropdowns (CreatableSelect)
One component for every list a person may extend: a normal dropdown, “+ Add new …” at the bottom, and, when allowed, a small bin on each row. Deleting always asks first in the row itself (“Delete X? Yes / No”), never with a hidden gesture, and a refusal (for example “3 people are in Sales”) is shown as a plain-language message. The component must be safe inside any form: it never renders its own `<form>`.

## Colour rule (enforced)
Primary actions, active tabs, selected chips, progress bars and links use `#0d7470`; titles `#0d4a47`; soft backgrounds `#f0fdfa` / `#dff3f1`. Status colours stay green / amber / red. Avatars and badges use the teal family and one warm accent. A browser audit visits every page of all seven demo roles and fails on any saturated blue, purple or pink.
