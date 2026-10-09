# Vook — User-Friendliness Audit

Standard: `RULES.md` → **User-friendly first**. Test: *can a new HR assistant do this without help?*
Audit date: 2026-10-08 · Scope: `src/pages` + `src/components` (110 UI files, 62 pages).

## 1. What the scan found

| # | Finding | Scale | Severity | Status |
|---|---|---|---|---|
| 1 | Raw error text reached users ("Request failed with status code 500", "Network Error", `PERMISSION_DENIED: …`) | 26 places read `response.data.message` / `err.message` | High | **Fixed centrally** in `extractError` (plain message per code/HTTP status; jargon filtered) |
| 2 | Login screen showed "Network/CORS error … (check browser console)" and "HTTP 401" | 1 screen, every user's first impression | High | **Fixed** |
| 3 | Machine values shown as labels (`NOTICE_PERIOD`, `MANAGER_APPROVED`, `ONBOARDING`, `PAST_DUE`) | 33 spots | High | **Fixed** — `statusLabel()` in 15 pages + `StatusBadge` |
| 4 | Hidden "add new" in dropdowns (type-to-reveal) | Department, Designation | High | **Fixed** — visible "+ Add new …" in `CreatableSelect` |
| 5 | CSV import used field names/formats (`joiningDate`, `YYYY-MM-DD`) | Employees import | High | **Fixed** — human headers, DD/MM/YYYY, ₹ and commas accepted, plain errors |
| 6 | Hardcoded department filter tabs / lists | Employees page | Medium | **Fixed** — from real department list |
| 7 | Native browser `window.confirm` pop-ups (unstyled, no explanation of consequence) | 6 (2FA off, sign-out all, lock attendance, mark paid, recalculate) | Medium | Backlog → `ConfirmDialog` |
| 8 | Generic "Failed to save/update/create …" with no next step | ~20 | Medium | Partly improved by #1; rewrite per screen in backlog |
| 9 | Plain "Loading…" text / spinners for slow data | ~45 places | Medium | **Fixed** — skeleton shimmer placeholders everywhere (`Skeleton.tsx`) |
| 10 | Pages without an empty state | ~29 of 62 pages | Medium | Backlog → `EmptyState` with a next action on every list |
| 11 | 2,207 inline `style={{}}` — inconsistent look, hard to theme/dark-mode/white-label | whole app | Medium | Backlog → migrate to design tokens/classes by portal |
| 12 | 35 `any` types — hide bugs that become confusing user errors | 35 | Low | Backlog |
| 13 | Search placeholders vary ("Name, ID, email or designation" vs "Search by name or ID...") | 4 | Low | Backlog → one wording |
| 14 | Permission-denied is silent (button just missing) | many | Medium | Fixed for org dropdowns; backlog for other pages |
| 15 | Technical page vocabulary ("Entitlements", "Scopes", "Workflows", "Reporting lines", "Regularization") | admin pages | Medium | Backlog → glossary + inline help |

## 2. Micro-point checklist (apply to every screen)

**Words**
- [ ] No codes, enums, field names, IDs or HTTP words anywhere.
- [ ] Same thing = same word on every screen (Employee, not Staff/Worker/Resource).
- [ ] Buttons are verbs: "Add employee", "Approve leave", not "Submit"/"OK".
- [ ] Dates `15 Jan 2026`, money `₹12,00,000`, numbers Indian grouping.

**Actions**
- [ ] Every action is a visible button/link (no hidden gestures).
- [ ] One obvious primary action per screen.
- [ ] Create-in-place for anything a form depends on.
- [ ] Destructive actions: styled confirm explaining the consequence + Undo where possible.
- [ ] Bulk actions preview before applying.

**Guidance**
- [ ] One-line "what is this page" under every title.
- [ ] Empty state: why empty + the button to fix it.
- [ ] Multi-step tasks show numbered steps and progress.
- [ ] Locked/hidden features explain why and who can unlock ("Upgrade plan" / "Ask your admin").

**Input**
- [ ] Accept real-world formats; normalise silently.
- [ ] Inline validation next to the field, in plain words, with how to fix.
- [ ] Never lose typed data on error/close (draft kept).
- [ ] Sensible defaults; optional fields clearly optional.
- [ ] Autofocus first field; Enter submits; Esc cancels.

**Feedback**
- [ ] Every action shows result: toast on success, inline on error, spinner while working, button disabled to avoid double submit.
- [ ] Error always says *what happened* + *what to do now* + retry.
- [ ] Offline/slow connection message.

**Access & inclusion**
- [ ] Works on a 360px phone with thumb-sized (44px) targets.
- [ ] Keyboard and screen-reader usable (labels, focus, contrast AA).
- [ ] Language switch (English, Hindi first), no text baked into images.
- [ ] Large-text and dark-mode safe.

## 3. Backlog (ordered by user impact)
1. `ConfirmDialog` + replace 6 `window.confirm`.
2. `EmptyState` on every list/table (29 pages).
3. Rewrite the ~20 "Failed to …" toasts per screen with next-step wording.
5. Page-intro + inline-help pattern; glossary tooltips for Roles, Scopes, Workflows, Regularization, Entitlements.
6. Unified search/filter bar wording + saved filters.
7. Inline-style → token classes (needed for white-label and dark mode in Phase 3).
8. First-run guided tour & setup checklist per role.
9. Hindi (and 2–3 regional languages) via i18n.
10. Usability testing: 5 real HR/finance users, recorded task success; target ≥ 90% unaided.

## 4. Done so far (code)
- `src/utils/friendly.ts` — `statusLabel`, plain error messages, jargon filter (+ tests).
- `src/utils/errorUtils.ts` — all `extractError` callers now get plain-language messages.
- `src/components/ui/CreatableSelect.tsx`, `components/org/OrgSelects.tsx` — visible "+ Add new".
- `src/utils/employeeCsv.ts`, `pages/hr/EmployeeImportDrawer.tsx` — friendly import.
- `LoginPage` — clear sign-in errors.

