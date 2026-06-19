# Design System & UX Specification — INTRVL Time Tracking & Resource Management Platform

**Document type:** Design System / UX Specification
**Product (working name):** INTRVL ("betterharvest")
**Status:** Draft for Architecture Synthesis
**Author:** UI/UX Designer (Forge `ux_design` phase)
**Date:** 2026-06-19
**Version:** 1.0
**Source of record:** `docs/PRD.md` v1.0 and `docs/TDD.md` v1.0 (FR/NFR/AC IDs referenced throughout)

> **Scope.** This document defines the UI/UX approach and the design system for INTRVL: target users, information architecture, interaction patterns, layout principles, the component inventory, accessibility requirements, responsive behaviour, and the visual language. It also **resolves the UI-layer technology decisions the TDD explicitly deferred to this phase** (component library, charts, icons, tokens — TDD §3 row "UI / design system" and §19.2). It does **not** implement code. Concrete token values are *design specifications* for the build phase, not committed source.
>
> **Material UI check (required by the phase brief).** INTRVL has a substantial, material UI — a responsive React SPA spanning timesheet capture, dashboards, approvals, invoicing, reporting, and an embedded AI copilot (TDD §3, §5; NFR-7). The "no material UI → define CLI/API conventions" branch therefore does **not** apply. The platform's REST + SignalR contracts are owned by the TDD (§5, §11); this document governs the human-facing surface.

---

## 1. Design Principles (the north stars)

These principles are derived directly from the PRD's cross-cutting governance rules (FR-GOV-1..5) and NFR-7. Every screen, component, and interaction is evaluated against them.

| # | Principle | What it means in the UI | Traces to |
|---|---|---|---|
| **P1** | **The timesheet is the hero.** | Time capture is the most-used, most-optimised surface. Everything else is in service of getting a correct, compliant week submitted in ≤5 minutes. | FR-GOV-1, G1, §3.2 |
| **P2** | **Guide, don't gate-keep silently.** | Show expected hours, allocation targets, and progress *before* the user makes a mistake. Validation is a coach, not a bouncer — but it blocks what must be blocked. | FR-TS-4, FR-VAL-*, NFR-7 |
| **P3** | **Commercial decisions are read-only to users.** | Rates, billable status, and overtime treatment are *displayed* (resolved server-side from project config) and never editable by consultants. The UI must never present them as a user choice. | FR-GOV-2/4, D2 |
| **P4** | **Exceptions surface; the compliant disappears.** | PMs see only what needs them (approval-by-exception). Compliant work auto-approves and recedes into counts, not queues. | FR-APR-1/5, G4 |
| **P5** | **Every state is legible.** | Draft / Validating / Compliant / Locked / Synced — the user always knows the state of their work and what transition is available next. Locked means visibly immutable. | FR-TS-9, PRD §9 |
| **P6** | **AI is a transparent assistant, never an autonomous actor.** | The copilot proposes; the human accepts, edits, or rejects. Permission denials are explained. Every action is attributable and reversible-before-commit. | FR-AI-2/3/10, NFR-11 |
| **P7** | **Trust through evidence.** | This is audit-grade, money-touching software. Numbers are precise (tabular figures), states are auditable, and destructive/irreversible actions (submit-lock, invoice issue) are deliberate and confirmed. | NFR-2/3, FR-INV-11 |
| **P8** | **Accessible and calm by default.** | WCAG 2.1 AA is a floor, not a goal. High data density without anxiety: generous neutral canvas, restrained colour, motion that respects user preference. | NFR-7 |

---

## 2. Target Users

Six personas drive the role-aware experience (PRD §2, §2.1, FR-IAM-11). Each gets a tailored default dashboard and a navigation set scoped by RBAC (FR-IAM-7/8). Design is **desktop-first** (the primary working context is a laptop/desktop during the work day) and **responsive down to tablet and phone** (NFR-7, NG5 — no native app in v1).

| Persona | Primary jobs-to-be-done | Device & context | UX priorities |
|---|---|---|---|
| **Consultant — Business Analyst** (Justice J) | Capture time fast, use timer, accept AI/DevOps suggestions, hit allocation target, submit by Friday | Desktop during the day; occasional phone glance | Speed of capture, real-time guidance, low-friction submission, celebration of streaks |
| **Consultant — Developer** (Alex G) | Same as BA + Azure DevOps work-item sync into drafts | Desktop; IDE-adjacent | DevOps refresh→preview→accept flow, ticket traceability in descriptions |
| **Consultant — Tester / Architect** | Capture against work types, same scoped capabilities | Desktop | Same as above, scoped to role's work types |
| **Project Manager** (Connor C) | Configure projects & commercial rules, allocate resources, approve by exception, manage budget, generate invoices | Desktop, multi-tasking | Exception triage, allocation conflict visibility, project health at a glance, commercial config clarity |
| **Finance** | Review/approve invoices, manage rates, track receivables | Desktop | Invoice workbench, reconciliation evidence, immutable snapshot confidence |
| **Executive / Delivery Manager** | Portfolio health, utilisation, margin, forecast | Desktop + large display; tablet for review | Scannable KPI dashboards, drill-down, trend & forecast, minimal data entry |
| **System Administrator** | Users, global config, AI config, scheduler, monitoring | Desktop | Dense admin tables, safe destructive actions, job/scheduler visibility |

**Cross-persona truth:** every authenticated user has a **persistent AI copilot** (FR-AI-12) and a **notifications centre** (FR-NOT-1). Consultants live in Timesheets; PMs live in Approvals + Projects; Execs live in Dashboards; Finance lives in Invoicing.

**Expertise & frequency.** Consultants are daily power users — optimise for keyboard-driven repetition (the grid). PMs/Finance are frequent but task-oriented — optimise for triage and confidence. Executives are infrequent — optimise for zero-learning scannability.

---

## 3. Information Architecture

### 3.1 Navigation model

A **persistent left sidebar** (primary navigation) + **top app bar** (context, search, notifications, copilot toggle, user menu) + **right-edge AI copilot dock** (collapsible). This three-zone shell is consistent across every authenticated screen and is the backbone of the app (see §6.1).

Navigation is **role-aware**: the sidebar renders only the sections the user's effective permission set allows (FR-IAM-7/8). Attempting to reach a disallowed route shows an in-app **"Access Denied"** state and logs a security event (FR-IAM-8, AC-IAM-4) — the route is never silently 404'd.

### 3.2 Top-level sections and role visibility

| Section | Route root | Admin | PM | Consultant | Finance | Exec |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** (role-specific home, FR-IAM-11) | `/` | ● | ● | ● | ● | ● |
| **Timesheets** (grid, timer, calendar) | `/timesheets` | ● | ● | ● | ○ | ○ |
| **Approvals** (exception queue) | `/approvals` | ● | ● | – | – | ○ |
| **Projects & Portfolio** | `/projects` | ● | ● | ◐ view | ○ | ● |
| **Capacity & Allocation** | `/capacity` | ● | ● | ◐ self | – | ● |
| **Azure DevOps** (sync, mapping) | `/devops` | ● | ● | ● | – | ○ |
| **Reporting & Analytics** | `/reports` | ● | ● | ◐ self | ● | ● |
| **Invoicing & Receivables** | `/invoicing` | ● | ◐ generate | – | ● | ○ |
| **Clients & Rates** | `/clients` | ● | ◐ | – | ● | ○ |
| **Workforce & Org** | `/workforce` | ● | ◐ | – | – | ○ |
| **Gamification** (leaderboards, badges) | `/engage` | ● | ● | ● | ○ | ● |
| **Administration** (users, config, scheduler, AI, monitoring) | `/admin` | ● | – | – | – | – |
| **Profile & Preferences** (incl. AI/notification prefs) | `/profile` | ● | ● | ● | ● | ● |

● full · ◐ scoped (Self/Team) · ○ read-only/summary · – hidden. Scopes resolve from FR-IAM-7 (Self/Team/Department/Global). Financial sections (Invoicing, Rates) are hidden from non-finance/non-authorised roles entirely (AC-IAM-4, NFR-1).

### 3.3 Screen map (primary screens per section)

- **Dashboard:** role-specific. Consultant = "My Week" (progress, targets, streak, copilot suggestions, quick capture). PM = exception summary + portfolio health. Exec = KPI/forecast dashboards. Finance = invoice pipeline. Admin = platform/scheduler health.
- **Timesheets:** Weekly Grid (default) · Timer panel · Month calendar view · Entry detail/edit · Submission summary & status.
- **Approvals:** Exception queue (list) · Timesheet review detail (diff vs targets, validation reasons) · Bulk actions · Approval history.
- **Projects:** Portfolio list · Project workspace (Overview/Health, Configuration wizard, Tasks, Team & Allocation, Commercial config, DevOps config, Compliance config) · Project state controls.
- **Capacity:** Allocation board (person × project × week) · Conflict view · Utilisation heatmap · What-if (SHOULD).
- **DevOps:** Connection config & handshake · Refresh & sync preview (accept/edit/skip per row) · Mapping manager · Sync history & coverage.
- **Reporting:** Report library · Report viewer (with drill-down) · Report builder (SHOULD) · Saved/shared reports · Exports.
- **Invoicing:** Invoice workbench (pipeline) · Invoice draft/preview · Finance review · Issued invoice (locked) + annexures · Receivables.
- **Engage:** Leaderboards (multi-scope) · Badge gallery · My achievements/streaks.
- **Admin:** Users · Roles & permissions · Global config (country/holiday/work rules) · AI config · Scheduler/jobs (Hangfire-backed) · Integration & platform health.

### 3.4 Wayfinding

- **Breadcrumbs** on all nested screens (Project → Workspace → Configuration).
- **Global search** in the app bar (projects, clients, users, tickets, invoices — scoped by permission).
- **Notifications centre** (bell, unread count) with categories: reminders, approvals, exceptions, integration failures, awards (FR-NOT-1..5).
- **Context switcher** for multi-project PMs/Execs (portfolio vs single project).
- **State is always in the chrome:** the current timesheet's status chip lives in the Timesheets header at all times (FR-TS-9).

---

## 4. Interaction Patterns

These are the reusable behavioural contracts. Consistency here is what makes 27 engines feel like one product.

### 4.1 Real-time validation (the most important pattern)

Validation runs on every entry, pushed via SignalR with a ≤300ms perceived-feedback target (NFR-4, FR-VAL-*, FR-TS-8). It maps the 35-rule matrix (Appendix A) onto exactly **three visual severities**:

| Severity | Meaning (Appendix A) | Visual treatment | Behaviour |
|---|---|---|---|
| **Block (error)** | `BLOCK` rules (e.g. #1 invalid hours, #3 missing project, #6 description too short, #10 inactive project) | Red field border + red inline message + red dot on the cell; cell-level error icon | Prevents save/submit of that entry; submission gate disabled until cleared |
| **Warning** | `NO BLOCK (warning)` rules (#7 no hours on working day, #8 below allocation, #19 unmapped ticket) | Amber field accent + amber inline message + amber dot | Save allowed; surfaces on the submission summary; may route to PM approval if unresolved |
| **Info / status** | `NO BLOCK` informational (#22 auto-approved, #34 holiday detected, #16 overtime pending) | Neutral/blue banner or chip | No obstruction; informs the user of system behaviour |

**Rules of the pattern:**
- **Inline-first.** Errors appear adjacent to the offending field/cell, not in a distant summary. A **submission summary** aggregates everything before submit (FR-AUTO-3 "Submission Failed" alert lists every validation error).
- **Message is the PRD message.** Use the exact Appendix A copy ("Description too short", "Allocation exceeded", "Overtime not allowed for this project"), extended with a recovery hint (§11).
- **Severity is never colour-only** — every severity carries an icon + text (P8, WCAG 1.4.1). Block = ✕ filled, Warning = △, Info = ⓘ.
- **Announced to assistive tech.** Validation results write to an `aria-live="polite"` region (block errors `assertive`) so screen-reader users get the same ≤300ms feedback (§10).

### 4.2 Optimistic capture in the grid

Hour edits commit optimistically (TanStack Query mutation, TDD §3) — the cell updates and totals recompute instantly; the server validation result reconciles ≤300ms later. On server rejection the cell reverts with the block message. This keeps the "fast as Harvest" promise (G1) without lying about persistence.

### 4.3 Alternative-day banners (holiday / leave)

When a day is a public holiday or falls in approved leave, the grid shows a **full-width day banner** (FR-TS-6/7, FR-LEAVE-3):
- Distinct banner colour (neutral-info, not error), icon, and label ("Public Holiday — Heritage Day" / "Approved Leave — Annual").
- Entry fields for that day are **disabled by default** (holiday) with a "Log time anyway" affordance if work genuinely occurred.
- Expected weekly hours visibly **recalculate** and the target meter updates.
- AI auto-fill is **suppressed** for those days and the UI states why (FR-AI-3, Appendix A #28).
- Missing-hour warnings are **suppressed** for covered days.

### 4.4 Approval-by-exception (PM)

The PM Approvals screen is an **exception queue, not an inbox** (FR-APR-5, P4):
- Header shows **counts only** for the healthy majority: Auto-approved, Awaiting approval, Rejected, Returned, plus the auto-vs-manual rate.
- The list contains **only timesheets that failed an auto-approval condition**, each card stating *which* condition failed (allocation breach, overtime exception, missing description, etc.) so triage is instant.
- Row actions: **Approve / Reject / Return with comments** (FR-APR-3). Return/Reject requires a comment (becomes the consultant's actionable feedback).
- Bulk approve is available for a filtered set; each action is individually audited.
- Overtime-exception items are visually tagged even when weekly hours are met (FR-APR-4).

### 4.5 AI copilot interaction (human-in-the-loop)

The copilot is a **persistent right-edge dock** (collapsible to a FAB), present on every screen (FR-AI-12). Modes: chat, suggestions, smart actions, and voice (voice = COULD, UI present, FR-AI-8/OQ5).

- **Propose → review → commit.** AI-suggested entries/descriptions appear as a **distinct, dashed-outline "draft suggestion" state** with **Accept / Edit / Reject** per item and **Accept all** for a batch (FR-AI-3/4, AC-AI mirrors the DevOps preview pattern §4.6). Nothing the AI proposes is persisted until the human commits.
- **Guards are visible.** If a suggestion would exceed allocation or fall on a holiday/leave day, the copilot states it won't and why (FR-AI-3, Appendix A #28/#29) rather than silently omitting.
- **Permission denials are explained.** When a user asks for something out of scope (e.g. a Developer requesting financial reports), the copilot returns a clear "you don't have access to X, and this request was logged" message — never a blank refusal (FR-AI-2, AC-AI-2).
- **Attribution.** Any field populated or changed by the copilot carries a subtle "✦ AI" marker until the user edits or explicitly confirms it, supporting auditability (FR-AI-10).
- **Request states** (Submitted → Processing → Completed/Failed/Cancelled, FR-AI-11) render as a thinking indicator with a cancel affordance and friendly failure + retry on error.

### 4.6 DevOps sync preview

Refresh → normalise → **preview table** → draft entries (FR-ADO-4/7). The preview table (`Project | Ticket | Status | Description`) supports per-row **Accept / Edit / Skip / change work type / change task / change description / save mapping override**. Unmapped tickets show an amber "not mapped" chip (warning, never a block — Appendix A #19). Accepted rows populate draft grid entries carrying the `[Ticket] - [Description]` template and estimate metadata.

### 4.7 Gamification feedback

Points/badges accrue **only after approval** (FR-GAM-1, Appendix A #26). Feedback:
- **Celebration popup** on badge award / streak milestone (FR-GAM-5) — a toast-class, dismissible moment. **Respects `prefers-reduced-motion`**: the animated confetti variant degrades to a static badge card (§10).
- **Header showcase** of current streak/level/points (compact, non-intrusive).
- Overtime never shows points unless the project allows it (FR-GAM-2) — the UI does not even render an overtime-points affordance for OT-disabled projects.
- Leaderboards are opt-in-visible per role rules (FR-GAM-4).

### 4.8 Feedback channels — when to use what

| Channel | Use for | Examples |
|---|---|---|
| **Inline (field/cell)** | Validation tied to a specific input | Block/warning on an entry |
| **Banner (in-page)** | Page-level state affecting the whole view | Holiday/leave day, "Submission Failed", integration "Not Configured" |
| **Toast (transient)** | Confirmation of a completed action; awards | "Timesheet submitted", badge popup |
| **Modal / confirm dialog** | Irreversible or high-consequence actions | Submit (locks the week), Issue invoice (immutable snapshot), deactivate user, override compliance |
| **Copilot dock** | Conversational help, suggestions, explanations | "Fill my missing hours", permission explanation |
| **Notifications centre** | Asynchronous, cross-session events | Approval result, escalation, integration failure, award |

### 4.9 Destructive & irreversible actions (P7)

Submit-lock (FR-AUTO-3), invoice issue (FR-INV-11), project closure, user deactivation, and compliance override (FR-VAL-8) all require an explicit confirm step that **names the consequence and its irreversibility** ("This locks your timesheet for week of 16 Jun — entries become read-only"). Override actions capture a reason (audited). Locked/approved/paid records render with a visible lock affordance and disabled controls (Appendix A #30).

### 4.10 Loading, empty, and error states (every screen has all three)

- **Loading:** skeleton screens for the grid and dashboards (the grid must *feel* ≤2s, NFR-4). Never a bare spinner for primary content.
- **Empty:** purposeful empty states with a primary action ("No projects yet — create your first project") and, for consultants, a copilot nudge.
- **Error:** user-friendly message + recovery guidance + retry (per CLAUDE.md error-handling guidance and NFR-10/12). Integration errors map to the connection state machine ("DevOps: Not Configured / Failed — reconnect").

---

## 5. Layout Principles

### 5.1 App shell

```
┌──────────────────────────────────────────────────────────────┐
│ Top App Bar: [logo] [breadcrumb/context]   [search][⌘K] [🔔][✦ copilot][user] │
├───────────┬──────────────────────────────────────┬───────────┤
│ Sidebar   │ Page region                          │ Copilot   │
│ (primary  │  ┌ page header (title, status chip, ─┐│ dock      │
│  nav,     │  │  primary actions)                 ││ (collapsi-│
│  role-    │  ├───────────────────────────────────┤│  ble; FAB │
│  aware,   │  │  content (grid / cards / tables)  ││  when     │
│  collap-  │  │                                   ││  closed)  │
│  sible)   │  └───────────────────────────────────┘│           │
└───────────┴──────────────────────────────────────┴───────────┘
```

- **Sidebar:** 240px expanded / 64px icon-rail collapsed. Sections grouped; active state clear; persists user preference.
- **Page region:** a max content width of ~1440px for reading-oriented screens; data grids and dashboards may go **full-bleed** to use the whole viewport (timesheet grid, allocation board, reports).
- **Copilot dock:** 360px slide-over from the right; overlays on small screens, pushes content on large screens; remembers open/closed per user.
- **Page header pattern:** title + state chip (left), primary/secondary actions (right). One — and only one — primary action per screen.

### 5.2 Grid system & spacing

- **Base unit: 4px.** All spacing, sizing, and radii are multiples (4/8/12/16/24/32/48/64).
- **Layout grid:** 12-column fluid grid with a 24px gutter (16px on tablet, 16px single-column on phone).
- **Density:** two density modes — **Comfortable** (default, marketing-grade screens, dashboards) and **Compact** (data grids, admin tables, allocation board) with reduced row height and padding. Density is a user preference for grid-heavy roles.

### 5.3 Data-density discipline

Enterprise data UI fails when it's noisy. Rules:
- Neutral canvas; colour reserved for **state and action**, never decoration (P8).
- Tables/grids use zebra-free, hairline row separators; alignment over borders.
- **Numeric columns are right-aligned and use tabular figures** (hours, money, percentages) so digits line up for scanning and reconciliation (P7, §8.2).
- Group related controls; one visual hierarchy per region.

---

## 6. Component Inventory

Built on a token-driven foundation (§9). Organised as **foundational primitives** (reused everywhere) and **domain composites** (INTRVL-specific). Each composite lists its key states because state legibility is a principle (P5).

### 6.1 Foundational primitives

- **Layout:** AppShell, Sidebar (+ icon-rail), TopBar, PageHeader, Breadcrumbs, ContentCard/Panel, Tabs, Accordion, Drawer/Slide-over, Resizable split.
- **Inputs:** TextField, NumberField (tabular, with step), TextArea (with min-length meter for descriptions, FR-VAL-7), Select/Combobox (project/task/work-type pickers), MultiSelect, DatePicker, DateRangePicker, WeekPicker, TimeDurationInput (hh:mm / decimal hours), Toggle, Checkbox, RadioGroup, Slider (allocation %), SearchInput, FileUpload.
- **Actions:** Button (primary/secondary/tertiary/danger), IconButton, SplitButton, MenuButton, Link.
- **Feedback:** InlineMessage (error/warning/info), Banner, Toast, Tooltip, Popover, Modal/Dialog, ConfirmDialog (consequence-naming, §4.9), ProgressBar, Spinner, Skeleton, EmptyState, ErrorState.
- **Data display:** DataTable (sortable/filterable/paginated, virtualised), DefinitionList, Stat/Metric, Tag/Chip, Badge (count), Avatar, Timeline (for audit/history), Tree.
- **Status:** **StatusChip** (the workhorse — see §6.3), Dot indicator, Pill.
- **Navigation:** NavItem, Pagination, Stepper/Wizard (project creation), CommandPalette (⌘K global search/actions).

### 6.2 Domain composite components

| Component | Purpose | Key states / variants | Reqs |
|---|---|---|---|
| **TimesheetGrid** | The core weekly capture surface: rows = project/task/work-type, columns = Mon–Sun, editable hour cells, daily + weekly totals | Empty · editing · cell-error/warning · holiday/leave column · locked (read-only) · loading skeleton | FR-TS-2/3/8 |
| **TimesheetCell** | Single day×row hour entry | empty · valid · block · warning · disabled (holiday) · ai-suggested · locked | FR-VAL-*, FR-AI-3 |
| **TargetMeter** | Allocation/expected-hours progress against target (per project & weekly) | under · on-target · over (warning) · adjusted-for-leave | FR-TS-4, FR-ALLOC-2 |
| **StatusChip** | Universal state token for any state-machined entity | per state machine (§6.3) | FR-TS-9, PRD §9 |
| **ValidationSummary** | Pre-submit aggregate of all errors/warnings | empty (ready) · has-blocks · has-warnings-only | FR-AUTO-3 |
| **TimerWidget** | Start/stop timer with project/task/work-type + rounding prompt on stop | idle · running · stop→rounding (15/30/60) | FR-TIMER-1/2/3 |
| **DayBanner** | Holiday/leave context banner in grid | holiday · approved-leave | FR-TS-6/7 |
| **ApprovalQueueCard** | One exception in the PM queue with failed-condition reasons | awaiting · returned · rejected · overtime-exception | FR-APR-5 |
| **ApprovalDiffPanel** | Timesheet review: logged vs target, listed reasons | — | FR-APR-3 |
| **AllocationBoard** | Person × project × week allocation with conflict detection | within-100% · over-allocated (blocked) · under-utilised (flag) | FR-ALLOC-3/5 |
| **CommercialConfigForm** | Project commercial rules (rate card, overtime, billing model) | — (PM/Admin only; consultants never see editable) | FR-PRJ-4/8, FR-GOV-2 |
| **DevOpsSyncPreview** | Normalised ticket table with per-row accept/edit/skip | retrieved · mapped · unmapped (warning) · skipped · accepted | FR-ADO-4/7 |
| **ConnectionStatePanel** | Integration handshake & status | Not Configured · Configuring · Testing · Connected · Failed · Disabled | FR-ADO-10 |
| **CopilotDock** | Persistent AI assistant: chat, suggestions, smart actions, voice | collapsed (FAB) · open · processing · failed · suggestion-review | FR-AI-12 |
| **SuggestionCard** | A single AI proposal awaiting human decision | proposed · accepted · edited · rejected · blocked-by-guard | FR-AI-3/4 |
| **InvoiceWorkbench** | Pipeline of draft/generated/issued invoices | draft · generated · approved · sent · partially-paid · paid · cancelled | FR-INV-1/12 |
| **InvoicePreview** | Sectioned invoice (standard, overtime, activity summary, financial) + annexures | draft (auto-syncing) · locked (issued snapshot) | FR-INV-6/9/11 |
| **KpiCard** | Single metric with trend & health band | exceptional · healthy · watch · under · action | FR-REP-5 |
| **UtilisationBand** | Health-band indicator (🟢🟠🔴 + label + value) | ≥95 · 85–94 · 75–84 · 60–74 · <60 | Appendix B |
| **ChartFrame** | Standardised dashboard chart wrapper (title, legend, drill-down, export) | loading · empty · error · interactive | FR-VIZ-*, FR-REP-7 |
| **DrillDownTable** | Hierarchical report navigation (Project→Resource→Task→Entry) | — | FR-REP-7 |
| **LeaderboardTable** | Ranked engagement table, multi-scope | global/role/team/project/compliance/productivity | FR-GAM-4 |
| **BadgeShowcase / StreakIndicator** | Achievement display & celebration | earned · displayed · revoked · award-popup | FR-GAM-3/5 |
| **AuditTrailTimeline** | Immutable event/transition history viewer | — (read-only) | FR-AUD-1/4 |
| **NotificationCenter** | Categorised async events | unread · read · failed-retry | FR-NOT-1/6 |
| **SchedulerJobTable** | Admin view of jobs/runs/history | queued · running · completed · failed | FR-ADM-2 |
| **AccessDeniedState** | Permission-blocked screen | — (logs security event) | FR-IAM-8 |

### 6.3 The StatusChip state palette (shared mapping)

A single component renders every state machine (PRD §9) with a consistent colour+icon+label vocabulary, so users learn the language once. Colour always pairs with an icon and text (P8).

| State family | States → tone | 
|---|---|
| **Timesheet** | Draft → neutral · Validating → info · Compliant/Ready → success-subtle · Submitted → info · Auto-Approved/Approved → success · Pending Approval → warning · Rejected → danger · Locked → neutral-locked · Synced → success-muted · Archived → muted |
| **Project** | Draft → neutral · Configuring/Validating → info · Active → success · On Hold → warning · Closed → muted · Archived → muted |
| **Invoice** | Draft → neutral · Generated → info · Approved → success-subtle · Sent → info · Partially Paid → warning · Paid → success · Cancelled → danger-muted |
| **DevOps Connection** | Not Configured → neutral · Configuring/Testing → info · Connected → success · Failed → danger · Disabled → muted |
| **Notification** | Queued → neutral · Sent → info · Delivered → success-subtle · Read → muted · Failed → danger |
| **AI Request** | Submitted/Processing → info · Completed → success · Failed → danger · Cancelled → muted |
| **Badge** | Not Earned → muted · Earned/Displayed → success · Revoked → danger-muted |

---

## 7. Responsive Behaviour

Responsive web is in scope; native mobile is not (NG5, NFR-7). Design **desktop-first, degrade gracefully**.

### 7.1 Breakpoints

| Token | Range | Layout |
|---|---|---|
| `xs` | < 480px | Single column; sidebar → bottom/overlay drawer; copilot → full-screen overlay |
| `sm` | 480–767px | Single column; condensed app bar |
| `md` | 768–1023px (tablet) | Sidebar → icon rail; 1–2 column content; copilot overlays |
| `lg` | 1024–1439px | Full sidebar; multi-column; copilot pushes content |
| `xl` | ≥ 1440px | Full shell; dashboards use extra columns; grids full-bleed |

### 7.2 The timesheet grid — the hard responsive case

The 7-column weekly grid does not shrink to a phone gracefully, so it **transforms** rather than scales:

- **`lg`+ (desktop):** full Mon–Sun grid, all rows and totals visible; keyboard-navigable matrix.
- **`md` (tablet):** horizontally scrollable grid with a **frozen first column** (project/task/work-type) and sticky totals row; day headers sticky.
- **`xs`/`sm` (phone):** grid collapses to a **day-by-day stacked view** — a day selector (Mon…Sun with per-day totals + status dots) over a vertical list of that day's entries. Add-entry is a full-width sheet. Weekly progress stays pinned at top. This keeps capture possible on a phone glance without pretending a spreadsheet fits.

### 7.3 Other responsive rules

- **Dashboards:** KPI cards reflow from 4-up → 2-up → 1-up; charts maintain min legible height and switch to scroll rather than crush.
- **Data tables:** prioritise columns by importance; secondary columns collapse into an expandable row detail on `md` and below.
- **Approval queue / invoice workbench:** cards stack; primary actions remain reachable (sticky action bar on small screens).
- **Touch targets:** ≥ 44×44px on touch breakpoints (WCAG 2.5.5 / AAA-leaning, applied as a baseline for tablet capture).
- **Copilot:** full-screen modal on `xs`/`sm`; never blocks the underlying primary action without a clear close.

---

## 8. Visual Language

INTRVL's expression: **professional, trustworthy, audit-grade, and calm under density.** It should feel like serious financial software that respects the user's attention — closer to a well-built fintech/analytics product than a playful consumer app, with engagement (gamification) as a warm accent, never the dominant note.

### 8.1 Colour

A **neutral-dominant** system. Brand and semantic colour are used sparingly for identity, state, and action. All pairings below are specified to meet **WCAG 2.1 AA contrast** (≥ 4.5:1 for text, ≥ 3:1 for large text / UI components, §10).

**Brand**
- **Primary — "Interval Indigo"** `#4F46E5` (indigo-600 family). Primary actions, active nav, focus accents. Hover/active/disabled ramps defined as tokens.
- **Primary tints/shades:** 50→900 ramp for backgrounds, hovers, and on-dark usage.

**Neutrals (the canvas — the most-used colours)**
- Greyscale ramp `0/50/100/200/300/400/500/600/700/800/900/1000` for surfaces, borders, text. Body text `neutral-800` on `neutral-0/50` surfaces.

**Semantic (state)** — each has bg / border / text / icon tokens, all AA-verified, all paired with iconography (never colour-alone):
- **Success** (green) — Active, Approved, Connected, Paid, healthy bands.
- **Warning** (amber) — below allocation, overtime pending, partially paid, watch band.
- **Danger** (red) — block errors, rejected, failed connection, action-required band.
- **Info** (blue) — validating, in-progress, holiday/leave banners, informational.
- **Neutral/Muted** — draft, archived, disabled, locked.

**Utilisation health bands (Appendix B)** map to semantic + an explicit label and value, never the dot alone:
`≥95% Exceptional` & `85–94% Healthy` → success · `75–84% Watch` & `60–74% Under-utilised` → warning · `<60% Action required` → danger.

**Dark mode:** the token system is built light-first with a dark theme as a token remap (surfaces/text invert via semantic tokens, not hard-coded hex). Dark mode is a **SHOULD** for v1 — tokens make it free later; ship light first.

### 8.2 Typography

- **UI typeface:** **Inter** (open-source, excellent legibility at small sizes, broad weights) as primary; system-font stack fallback. **`Inter` numerals set to `tabular-nums`** for every numeric context (hours, money, %, IDs) — non-negotiable for grids, totals, and invoices (P7, §5.3).
- **Monospace:** `JetBrains Mono` / system mono for IDs, ticket numbers, audit hashes, code-like data.
- **Type scale (rem, 1rem = 16px base):** Display 32 · H1 24 · H2 20 · H3 18 · Body-lg 16 · Body 14 (default UI) · Small 13 · Caption 12. Line-heights 1.4–1.5 body, 1.2–1.3 headings.
- **Weights:** 400 body · 500 medium (labels, emphasis) · 600 semibold (headings, key numbers) · 700 sparingly.
- **Default UI body is 14px** (enterprise density), with 16px for reading-oriented/marketing surfaces and forms on mobile (prevents iOS zoom).

### 8.3 Spacing, radius, elevation

- **Spacing:** 4px base scale (§5.2).
- **Radius:** `sm` 4px (inputs, chips) · `md` 8px (cards, buttons) · `lg` 12px (modals, panels) · `full` (avatars, pills). Calm, slightly rounded — not pill-heavy.
- **Elevation:** a restrained 4-level shadow scale (0 flat surfaces → 1 cards → 2 popovers/dropdowns → 3 modals/drawers). Borders (hairline `neutral-200`) do most of the separation work; shadows reserved for true layering. This keeps dense screens flat and calm.

### 8.4 Iconography

- **Lucide** icon set (open-source, consistent 24px grid, pairs naturally with the chosen component foundation). 16px/20px/24px sizes via tokens.
- Icons **reinforce** meaning, never replace labels in primary nav or status (P8). Each semantic severity and each status family has a fixed icon (§4.1, §6.3) so meaning is learned once.

### 8.5 Motion

- **Purposeful and quick.** Durations: 100ms (hover/press), 150–200ms (enter/exit, dropdowns), 250–300ms (drawers/modals). Standard ease-out for entrances, ease-in for exits.
- **Motion communicates state**, not delight-for-its-own-sake: skeleton→content fades, optimistic cell commits, copilot "thinking" pulse, drawer slides.
- **The single celebratory exception:** gamification award popups (FR-GAM-5) may use richer motion — and **must** check `prefers-reduced-motion` and degrade to a static card (§10). All non-essential motion respects the same media query.

### 8.6 Imagery & illustration

- Sparse. Used only for **empty states** and **gamification** (badge art, milestone celebrations). Flat, geometric, on-brand; never stock-photo clutter on working screens. Badges form a small, consistent illustrated set.

---

## 9. UI-Layer Technology Decisions (resolving TDD §3 / §19.2)

The TDD set React 18 + TypeScript + Vite + TanStack Query and explicitly deferred the **UI/design-system library** and confirmed-but-open **chart library** to this phase. Decisions below, presented as primary + documented alternative (mirroring the TDD's decision style).

| Concern | Decision | Rationale | Alternative (documented) |
|---|---|---|---|
| **Component foundation** | **Radix UI primitives + Tailwind CSS, composed in the shadcn/ui pattern** (owned, in-repo components) | Accessible-by-default primitives (focus, keyboard, ARIA handled at the primitive layer — directly serves WCAG 2.1 AA, NFR-7); full control over a *product* visual language rather than a vendor look; tokens map cleanly to Tailwind config; components are owned in-repo, so no library lock-in for a 27-engine, long-lived platform | **Mantine** (batteries-included, strong data components) or **MUI** (mature, but heavier to re-skin to a custom brand) |
| **Data grid / tables** | **TanStack Table v8** (headless) for the TimesheetGrid, AllocationBoard, DrillDownTable, and admin tables; virtualised via TanStack Virtual | Headless = full control over the dense, editable, keyboard-navigable timesheet matrix and optimistic updates (pairs with the TDD's TanStack Query); virtualisation keeps the ≤2s grid load (NFR-4) | AG Grid (powerful but heavy/commercial for advanced features) |
| **Charts** | **Recharts** as primary (confirms the TDD's first option) for standard dashboard charts; **visx** reserved for bespoke visualisations (utilisation heatmaps, burn-down) | Recharts covers 90% of dashboard needs with low effort and good a11y hooks; visx for the few custom cases | ECharts (rich, but larger API surface) |
| **Icons** | **Lucide** (§8.4) | Consistent, open-source, pairs with the foundation | Phosphor |
| **Forms & validation (client)** | **React Hook Form + Zod** | Performant forms, schema validation mirroring server FluentValidation rules (Appendix A) for instant client feedback before the authoritative server check | Formik |
| **Design tokens** | **CSS custom properties** generated from a single token source (e.g. Style Dictionary), consumed by Tailwind config | One source of truth for light/dark + density; survives a future library change | Tailwind config only |
| **i18n / formatting** | **react-i18next + Intl** APIs; locale-aware dates, numbers, and **ZAR currency** formatting; tabular figures for all numerics | NFR-8 (country/timezone/holiday-aware, multi-currency data model, ZAR default); RTL-readiness via logical CSS properties | FormatJS |
| **Realtime client** | **SignalR client** (TDD §3) feeding `aria-live` validation + gamification + report refresh | Matches the backend transport (NFR-4, FR-REP-6, FR-GAM-5) | — |

`ASSUMPTION` — final confirmation of the component foundation (shadcn/Radix vs Mantine) belongs to Architecture Synthesis alongside the rest of the TDD `ASSUMPTION` items (TDD §19.2). This document recommends shadcn/Radix + Tailwind and specifies tokens accordingly.

---

## 10. Accessibility Requirements (WCAG 2.1 AA — the floor)

Target **WCAG 2.1 Level AA** across the product (NFR-7). Accessibility is specified per pattern, not bolted on.

**Perceivable**
- **Colour is never the only signal** (1.4.1). Every status, severity, and utilisation band pairs colour with an icon and a text label (§4.1, §6.3, §8.1).
- **Contrast** (1.4.3/1.4.11): text ≥ 4.5:1, large text & UI components/states ≥ 3:1. All semantic tokens in §8.1 are specified to pass; the token pipeline includes a contrast lint gate.
- **Text resize / reflow** (1.4.4/1.4.10): layouts reflow to 320px and support 200% zoom without loss; no fixed-pixel text traps.
- **Tabular figures** improve scannability of numeric data for everyone, including low-vision users (§8.2).

**Operable**
- **Full keyboard operability** (2.1.1): every action reachable without a mouse. The **TimesheetGrid is a proper ARIA grid** — arrow-key cell navigation, Enter to edit, Tab to move between editable regions, Esc to cancel an edit. The CommandPalette (⌘K) is keyboard-first.
- **Focus visible** (2.4.7): a high-contrast focus ring on every interactive element (uses the primary accent; meets non-text contrast).
- **Focus management:** modals/drawers/copilot trap focus while open and restore it on close; route changes move focus to the page heading.
- **No keyboard traps**; logical tab order following visual order.
- **Touch targets** ≥ 44×44px on touch breakpoints (§7.3).
- **Timing:** session-timeout warnings (FR-IAM-2) give a chance to extend (2.2.1); the timer is user-controlled (no enforced time limits on tasks).

**Understandable**
- **Labels & instructions** (3.3.2): every input has a visible, programmatic label; placeholder is never the only label. The description field shows its min-length requirement inline (FR-VAL-7).
- **Error identification & suggestion** (3.3.1/3.3.3): errors are tied to their field via `aria-describedby`, state the problem in plain language (Appendix A copy), and offer a fix (§11).
- **Consistent navigation & identification** (3.2.3/3.2.4): the shell, status vocabulary, and component behaviour are identical across all 27 engines' screens.

**Robust**
- **Live regions** (4.1.3): real-time validation results, copilot status, and submission outcomes announce via `aria-live` (`polite` for warnings/info, `assertive` for blocking errors and submission failures) so the ≤300ms feedback (NFR-4) is non-visual-equivalent.
- **Name/role/value** (4.1.2): all custom components (grid, status chip, target meter, copilot) expose correct ARIA roles/states.
- **Reduced motion** (2.3.3 / respecting `prefers-reduced-motion`): all non-essential animation — including gamification celebrations (§4.7) — degrades to static.

**Voice copilot accessibility (FR-AI-8, COULD):** voice input is an *additive* modality, never the only way to perform an action; all voice-triggered actions are equally available via keyboard and pointer, and transcripts are presented as readable text.

**Process:** automated checks (axe) in CI on the component library and key flows; manual keyboard + screen-reader (NVDA/VoiceOver) passes on the critical journeys (capture→submit, approval, invoice issue) before each release.

---

## 11. Content & Microcopy Guidelines

- **Voice:** clear, professional, calm, second person. No jargon where plain language works; no blame ("Description too short" not "You failed to…").
- **Validation messages = Appendix A copy + recovery.** Use the authoritative message and append a fix: *"Description too short — add at least 20 characters describing what you did."* *"Allocation exceeded — reduce hours on this project or request approval from your PM."*
- **Empty states** state what's missing and the one action that fixes it.
- **Errors** (system/integration) explain what happened, that it isn't the user's fault where true, and the next step (NFR-10/12, CLAUDE.md error-handling). e.g. *"Couldn't reach Azure DevOps. Your timesheet is safe. Retry, or continue capturing manually."*
- **Irreversible-action copy** names the consequence explicitly (§4.9).
- **AI copilot** is helpful and bounded: it explains permission limits plainly and never implies it acted autonomously.
- **Numbers, dates, currency:** locale-formatted; ZAR with `R` symbol and correct grouping; hours shown consistently (decimal `7.5h` or `7:30` per a single product-wide choice — recommend **decimal hours** to match allocation maths in Appendix B).

---

## 12. Critical-Screen UX Notes (abbreviated specs)

Detailed wireframes are produced in build; these capture the intent for the highest-stakes screens.

- **Timesheet Weekly Grid (FR-TS):** full-bleed grid, frozen first column, sticky totals + day headers, persistent **status chip** and **weekly TargetMeter** in the header; inline validation per cell; holiday/leave **DayBanner**s; **TimerWidget** docked; copilot suggestions enter as dashed AI-draft cells; one primary action: **Submit** (opens consequence-confirm). Submission summary lists every block/warning (FR-AUTO-3).
- **PM Approvals (FR-APR):** counts header (auto-approved / awaiting / rejected / returned + auto-rate); exception-only list of **ApprovalQueueCard**s each naming the failed condition; review detail shows **ApprovalDiffPanel** (logged vs target) with Approve/Reject/Return(+comment); bulk approve on filtered set; everything audited.
- **DevOps Sync (FR-ADO):** **ConnectionStatePanel** reflecting the connection state machine; **DevOpsSyncPreview** table with per-row accept/edit/skip and mapping overrides; unmapped = amber warning; accepted rows → grid drafts with ticket traceability.
- **Invoice Workbench (FR-INV):** pipeline by invoice state; **InvoicePreview** with the four mandated sections (standard PS, approved overtime, activity summary, financial summary) auto-syncing while Draft; finance review actions; **Issue** triggers a consequence-confirm and renders the invoice **Locked** with an immutable-snapshot indicator and downloadable annexures.
- **Executive Dashboard (FR-VIZ/REP):** scannable **KpiCard** row with **UtilisationBand** health, trend sparklines, and **ChartFrame** panels (revenue, utilisation, compliance, budget burn) with **DrillDownTable** (Project→Resource→Task→Entry); approved-only data with live refresh and no stale cache (FR-REP-6).
- **Consultant "My Week" Dashboard:** progress to target, streak/level showcase (subtle), copilot proactive suggestions (missing days, DevOps tickets to review), and a one-click jump into the grid.

---

## 13. Handoff & Open Items for Architecture Synthesis

1. **Confirm the component foundation** (shadcn/Radix + Tailwind recommended) alongside the TDD's other `ASSUMPTION` items (TDD §19.2).
2. **Tokenisation:** stand up the Style-Dictionary → CSS-vars → Tailwind pipeline; lock the light theme; defer dark theme to a token remap (SHOULD).
3. **Hours display convention** (decimal vs hh:mm) — recommend decimal; confirm at sign-off.
4. **Dark mode scope** for v1 (recommended: tokens ready, ship light-first).
5. **Voice copilot UI** — present the affordance but gate behind the FR-AI-8 (COULD) feature flag in v1.
6. **Accessibility gate:** wire axe into CI and define the manual keyboard/SR test matrix for the critical journeys (§10).
7. Produce **high-fidelity wireframes/prototypes** for the critical screens (§12) before/with the Epics & Stories phase.

---

*End of Design System & UX Specification v1.0 — aligned to PRD v1.0 and TDD v1.0. Resolves the UI-layer technology deferral (TDD §3/§19.2). Ready for Architecture Synthesis and the Epics & Stories phase.*
