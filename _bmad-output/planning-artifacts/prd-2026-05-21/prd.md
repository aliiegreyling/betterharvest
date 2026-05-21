---
title: BetterHarvest
status: draft
created: 2026-05-21
updated: 2026-05-21
---

# PRD: BetterHarvest

## 0. Document Purpose

This PRD defines the product requirements for BetterHarvest, a modern Harvest-style SaaS product for time tracking, timesheets, project profitability, invoicing, and team planning. It is written for product, design, architecture, engineering, QA, security, and documentation workflows. Requirements are grouped by user-facing capability with stable functional requirement IDs for downstream UX, architecture, epics, and sprint planning.

## 1. Vision

BetterHarvest helps service teams capture accurate time, understand project health, and turn approved work into confident reports and invoices. It keeps the simplicity that made Harvest-style tools attractive, but modernizes the daily experience with fast weekly entry, calendar views, favorites, command palette workflows, project finance dashboards, and AI-assisted suggestions that users can inspect before accepting.

The product is for teams whose profitability depends on truthful time data: agencies, consultancies, software delivery teams, freelancers with collaborators, and managers responsible for budgets and utilization. BetterHarvest should reduce the daily annoyance of time tracking while increasing trust in the data managers use for staffing, billing, and client communication.

BetterHarvest must not become surveillance software. Automatic capture and AI recommendations are assistive, transparent, opt-in where sensitive, and auditable.

## 2. Target Users

### 2.1 Personas

- **P1. Consultant / Individual Contributor** — Logs time across client projects, wants minimal interruption, often reconstructs time at the end of the day or week.
- **P2. Project Manager** — Monitors budgets, delivery progress, missing time, approval queues, and client-ready reporting.
- **P3. Operations / Finance Manager** — Needs approved time, expenses, rates, invoices, exports, audit trails, and reliable month-end close.
- **P4. Agency / Consultancy Owner** — Watches profitability, utilization, capacity, overdue approvals, and risky engagements.
- **P5. Admin / System Owner** — Configures organization settings, roles, permissions, integrations, billing rules, and retention.

### 2.2 Jobs To Be Done

- When I start work on a client task, I want to track time in one click so I do not lose billable work.
- When Friday arrives, I want an accurate weekly timesheet without reconstructing everything from memory.
- When a project drifts, I want early warnings about budget burn, margin, scope creep, and staffing risk.
- When clients ask for status, I want credible reports that explain work completed and budget remaining.
- When billing time arrives, I want approved time and expenses to become invoice drafts with minimal manual cleanup.
- When AI suggests entries or summaries, I want to understand the evidence and control what gets saved.

### 2.3 Non-Users for MVP

- Deskless workforce operations requiring GPS-first shift enforcement.
- Highly regulated enterprise workforce monitoring programs.
- Payroll-only buyers whose primary need is wage calculation rather than project profitability.
- Native mobile-only teams. MVP is responsive web/PWA first.

### 2.4 Key User Journeys

- **UJ-1. Maya tracks time without breaking flow.** Maya is a software consultant starting a client ticket. From the command palette or global timer, she selects a recent project/task and starts a timer in one action. Later, she adds a note, marks the entry billable, and stops the timer. The day view shows the entry immediately, and the weekly grid reflects total billable hours.

- **UJ-2. Leo finishes a weekly timesheet in minutes.** Leo reaches Friday with scattered manual entries, calendar meetings, and suggested work blocks. He opens the weekly timesheet grid, accepts relevant suggestions, fills gaps, resolves warnings, and submits. The system blocks submission only for policy violations and records an audit event.

- **UJ-3. Priya approves team time with confidence.** Priya opens Approvals, filters by team and week, sees missing time, overtime, budget warnings, and unusual entries. She approves clean timesheets in bulk, returns one with a comment, and the submitter receives a notification.

- **UJ-4. Sam sees a project margin problem early.** Sam opens a project dashboard and sees budget burn, billable realization, cost, margin, and forecast-to-complete. BetterHarvest explains that senior staff are logging against a low-rate retainer and suggests reviewing staffing or estimate assumptions.

- **UJ-5. Nora drafts an invoice from approved work.** Nora selects a client billing period, reviews approved billable time and expenses, edits invoice line grouping, previews tax/discount totals, and sends or exports an invoice. Every invoice line links back to source approvals.

- **UJ-6. Alex asks a natural-language reporting question.** Alex asks, "How much non-billable time did we spend on Client X last month, and why?" The AI assistant produces a report with filters, charts, caveats, source links, and export options without modifying records.

## 3. Glossary

- **Organization** — Tenant boundary for users, clients, projects, settings, roles, billing, and data isolation.
- **User** — Person with an account in one or more organizations.
- **Team** — Group of users used for management, reporting, capacity, and approval routing.
- **Client** — External or internal customer associated with projects, budgets, invoices, and reports.
- **Project** — Billable or non-billable work container owned by an organization and optionally linked to a client.
- **Task** — Type of work under a project, such as Development, Design, QA, or Project Management.
- **Time Entry** — Dated duration or running timer associated with user, project, task, billability, notes, and tags.
- **Timesheet** — Weekly or configurable-period collection of time entries submitted for approval.
- **Approval** — Decision on a timesheet or expense, including approver, status, comments, and audit trail.
- **Budget** — Time, fee, retainer, or cost constraint for a client, project, task, or period.
- **Rate** — Billable or cost amount applied by user, role, task, project, or client.
- **Invoice** — Client-facing billing document generated from approved time, expenses, and manual line items.
- **AI Suggestion** — Draft recommendation with source evidence, confidence, explanation, status, and user action.

## 4. Product Principles

- Time tracking must be faster than remembering to do it later.
- AI can suggest, summarize, and explain, but humans approve records that affect billing or payroll.
- Financial numbers must be traceable to source records.
- Managers need early warnings, not just historical reports.
- The product should feel calm and fast: keyboard-friendly, mobile-friendly, readable dashboards, light/dark mode.

## 5. Features And Requirements

### 5.1 Authentication, Organization, Roles

**Description:** Users can sign up, create or join organizations, manage teams, and operate under role-based permissions.

#### FR-1: Account and session management
Users can sign up, sign in, sign out, refresh sessions, and manage basic profile settings.

**Consequences:**
- Sessions expire according to organization policy.
- API requests without valid sessions return `401`.
- Session events are audit logged.

#### FR-2: Organization setup
Admins can create an organization, configure default currency, timezone, week start, timesheet period, billing settings, and approval policy.

#### FR-3: Role-based access
Admins can assign roles and permissions for owner, admin, manager, member, finance, and client-viewer roles.

### 5.2 Clients, Projects, Tasks, Rates

#### FR-4: Client management
Authorized users can create, update, archive, and search clients with billing details and default settings.

#### FR-5: Project management
Authorized users can create projects linked to clients, assign members, set billability, budgets, rates, tags, and status.

#### FR-6: Task catalog
Authorized users can define reusable tasks and project-specific task availability.

#### FR-7: Rate rules
Finance/admin users can define billable rates and cost rates by organization, client, project, task, user, or role with clear precedence.

### 5.3 Time Tracking

#### FR-8: One-click timer
Users can start, pause, resume, and stop a timer from global UI, project pages, favorites, recents, and command palette. Realizes UJ-1.

#### FR-9: Manual time entry
Users can add and edit dated time entries with project, task, duration, notes, billability, tags, and optional start/end time.

#### FR-10: Weekly timesheet grid
Users can enter time by project/task rows and weekdays with inline validation, totals, keyboard navigation, and mobile-friendly editing. Realizes UJ-2.

#### FR-11: Calendar time entry
Users can view, create, drag, resize, and edit time blocks in a calendar layout.

#### FR-12: Favorites and recents
Users can pin recurring project/task combinations and reuse recent entries to reduce repeated setup.

#### FR-13: Missing and suspicious time detection
The system flags missing days, unusually long entries, overlapping entries, policy violations, and unsubmitted weeks.

### 5.4 Timesheets And Approvals

#### FR-14: Timesheet submission
Users can submit a timesheet period after resolving blocking validation errors.

#### FR-15: Approval workflow
Managers can approve, bulk approve, reject, or return timesheets with comments and notifications. Realizes UJ-3.

#### FR-16: Timesheet locking
Approved timesheets are locked from normal edits. Corrections require permission, reason, and audit trail.

### 5.5 Dashboards, Reports, Budgets, Profitability

#### FR-17: Personal dashboard
Users see today's timer, weekly progress, missing time, submitted/approved status, favorites, and suggestions.

#### FR-18: Manager dashboard
Managers see team submission status, approval queue, utilization, budget warnings, and capacity risks.

#### FR-19: Reports
Users with permission can filter, group, save, share, export, and schedule reports across time, clients, projects, users, tasks, billability, tags, and approval status.

#### FR-20: Budgets
Managers can configure project/client budgets by hours, fees, retainers, cost, or recurring period.

#### FR-21: Profitability insights
Authorized users can view revenue, cost, margin, billable realization, budget burn, and forecast-to-complete. Realizes UJ-4.

### 5.6 Invoicing And Expenses

#### FR-22: Expense capture
Users can create expenses with project/client, category, amount, currency, receipt attachment, reimbursable/billable flags, and approval status.

#### FR-23: Invoice draft generation
Finance users can generate invoice drafts from approved billable time and expenses, grouped by configurable rules. Realizes UJ-5.

#### FR-24: Invoice lifecycle
Finance users can edit, send/export, mark sent, record payment, void, and audit invoices.

### 5.7 Capacity Planning

#### FR-25: Capacity and allocation planning
Managers can view user capacity, planned allocations, utilization, project demand, and scheduling conflicts.

#### FR-26: Capacity risk summaries
The system summarizes over-allocation, under-utilization, and delivery risk across teams and projects.

### 5.8 Integrations

#### FR-27: Calendar integrations
Users can connect Google or Microsoft calendars to view meetings and generate time suggestions.

#### FR-28: Work system integrations
Users can connect GitHub, Jira, Azure DevOps, and similar systems to provide evidence for time suggestions and progress summaries.

#### FR-29: Accounting and payment integrations
Finance users can connect accounting/payment systems for invoice export and payment reconciliation.

### 5.9 AI Assistant And Suggestions

#### FR-30: AI time suggestions
The system can suggest time entries from calendar, commits, tickets, and activity evidence. Users can accept, edit, dismiss, or explain each suggestion.

#### FR-31: AI timesheet summary
Users can generate weekly summaries for managers or clients from submitted/approved time.

#### FR-32: AI project risk explanation
Managers can ask why a budget is burning quickly and receive source-linked explanations.

#### FR-33: Natural-language report builder
Authorized users can ask reporting questions and receive query-backed answers with filters and source links. Realizes UJ-6.

#### FR-34: AI invoice drafting support
Finance users can draft invoice descriptions from approved records. AI cannot send invoices or create payable records without explicit confirmation.

## 6. Non-Goals

- Building an employee surveillance platform.
- Replacing accounting systems in MVP.
- Native desktop automatic tracking in MVP.
- GPS/kiosk/shift-work enforcement in MVP.
- Payroll processing in MVP.
- Fully autonomous AI approval, billing, or record mutation.

## 7. MVP Scope

### 7.1 In Scope

- Auth and organization setup.
- Roles and permissions.
- Clients, projects, tasks, members.
- Manual time entry, timer, weekly timesheet grid.
- Submit/approve workflow.
- Basic dashboard and basic reports.
- Core audit logging.
- Responsive web UI with light/dark mode foundation.
- Production-ready repository scaffold and deployment baseline.

### 7.2 Out Of Scope For MVP

- Invoicing, expenses, budgets, rates, and notifications beyond basic placeholders.
- AI suggestions, integrations, natural-language reporting.
- Capacity planning.
- Mobile native apps.
- Payroll, kiosk, GPS, screenshot monitoring.

## 8. Roadmap

### MVP

Auth, organization setup, clients/projects/tasks, manual time tracking, timer, weekly timesheets, submit/approve workflow, basic reports, basic dashboard.

### V1

Budgets, rates, invoicing, expenses, notifications, team dashboards, exports, audit logs, invoice-ready reporting.

### V2

AI suggestions, calendar integrations, Jira/Azure DevOps/GitHub integrations, capacity planning, profitability insights, natural-language reports.

## 9. Cross-Cutting Requirements

- **Performance:** Core time entry actions should respond under 200 ms server processing time for normal load. Dashboard/report queries should use pagination, caching, and pre-aggregation where needed.
- **Reliability:** Time entry, approval, invoice, and audit writes must be transactional.
- **Security:** Tenant isolation must be enforced in every application use case and repository query.
- **Privacy:** Automatic activity and integration evidence must be transparent, configurable, and revocable.
- **Accessibility:** Web app targets WCAG 2.2 AA.
- **Auditability:** Financially meaningful records must preserve created/updated/deleted metadata and decision history.
- **Localization readiness:** Currency, timezone, date format, and week start must be organization-aware.

## 10. Success Metrics

- **SM-1:** 80% of active users log time on at least 4 workdays per week within 60 days of rollout. Validates FR-8 through FR-13.
- **SM-2:** Median weekly timesheet completion time under 5 minutes for regular contributors. Validates FR-10, FR-13, FR-14.
- **SM-3:** 90% of submitted timesheets approved or returned within 2 business days. Validates FR-15.
- **SM-4:** Managers identify project budget risk before 80% budget consumption for at least 70% of risky projects. Validates FR-20, FR-21, FR-32.
- **SM-C1:** Do not increase time-entry correction rate above 10%; speed cannot come at the cost of bad data.
- **SM-C2:** Do not allow AI acceptance rate to be optimized without measuring user edits and dismissals.

## 11. Open Questions

1. Confirm whether `BetterHarvest` is the final product name or only repo name.
2. Confirm final stack: full Next.js backend APIs vs separate .NET 10 backend service.
3. Choose ORM: Prisma for ecosystem speed or Drizzle for SQL-forward type safety.
4. Confirm authentication provider: Auth.js, Clerk, Azure AD B2C, or custom OIDC-ready implementation.
5. Confirm billing and pricing strategy.
6. Confirm whether MVP needs invoice placeholders or no invoice surface at all.
7. Confirm AI provider strategy and data retention policy.
8. Confirm whether automatic activity tracking is web/integration-only or eventual desktop agent.

## 12. Assumptions Index

- Product name is BetterHarvest.
- MVP is production SaaS, not an internal prototype.
- Primary stack is full-stack Next.js with PostgreSQL.
- MVP favors manual tracking and approval quality before AI automation.
- Calendar, work-system, and AI features are V2 unless pulled forward.
