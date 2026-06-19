# Product Requirements Document — INTRVL Time Tracking & Resource Management Platform

**Document type:** PRD
**Product (working name):** INTRVL ("betterharvest")
**Status:** Draft for sign-off
**Author:** Business Analyst (Forge BA phase)
**Date:** 2026-06-19
**Version:** 1.0

---

## 1. Purpose

### 1.1 Problem statement
Professional-services and delivery organisations (consultancies, software houses, agencies) need to capture time, manage resource allocation, enforce timesheet compliance, integrate with delivery tooling (Azure DevOps), bill clients accurately, and report on utilisation and profitability. Harvest and similar tools cover parts of this but lack tightly-coupled allocation compliance, project-governed billing rules, native Azure DevOps work-item synchronisation, an AI productivity copilot, and engagement (gamification) mechanics.

### 1.2 Product vision
INTRVL delivers **Harvest feature parity plus enhancements**: a single, auditable source of truth where the **timesheet is the master record** and every downstream module (allocation, compliance, approval, billing, reporting, gamification, AI) derives from it. Commercial behaviour is **inherited from project configuration**, never decided by individual users. Every state transition is **validated, permission-checked, and immutably audited**.

### 1.3 Scope of this PRD
This PRD defines the requirements for the full platform across 20+ functional engines, a pre-seeded UAT environment, and the enhancements that differentiate INTRVL from Harvest. It is the requirements baseline for the subsequent Architecture, UX, and Epics/Stories phases. It does **not** specify implementation, technology stack choices, or code (those follow in later phases).

### 1.4 Harvest parity vs. enhancement framing
The user's intent is explicit: *"match the capability but with enhancements."* Throughout this document:
- **[PARITY]** marks capabilities that bring INTRVL level with Harvest / Harvest-Forecast.
- **[ENHANCEMENT]** marks capabilities that exceed Harvest, drawn from the requirements pack (allocation compliance, AI copilot, gamification, project-governed commercial rules, native Azure DevOps sync, approval-by-exception, immutable audit ledger).

---

## 2. Stakeholders

| Stakeholder | Interest / Role in product |
|---|---|
| **Executive / Director** | Portfolio health, revenue, margin, utilisation, forecast — strategic dashboards. |
| **Delivery Manager** | Cross-project capacity, resource conflicts, delivery risk, portfolio reporting. |
| **Project Manager (PM)** — *e.g. Connor C* | Creates/manages projects, allocates resources, approves timesheets (by exception), configures overtime, manages budget, generates invoices, reviews reports. |
| **Business Analyst (consultant)** — *e.g. Justice J* | Captures time, uses timer, AI assistant, Azure DevOps integration, personal reporting, submits timesheets. |
| **Developer (consultant)** — *e.g. Alex G* | Captures development effort, synchronises Azure DevOps work items, validates overtime rules, submits timesheets. |
| **QA / Tester / Architect** | Capture time against work types; same consultant capabilities scoped to role. |
| **Finance** | Reviews/approves invoices, manages rates, receivables. |
| **System Administrator** | User administration, global configuration, AI configuration, scheduler, platform monitoring, security. |
| **Client (Eskom, etc.)** | Receives invoices and supporting annexures; billing preferences and segmentation maintained on their behalf. |
| **Product Owner / Sponsor** | Owns this PRD and sign-off. |

### 2.1 Primary personas (UAT seed)
- **Connor C** — Project Manager, Delivery. Manages projects, no allocation.
- **Justice J** — Business Analyst, 100% allocated to Eskom Modernisation Programme, 40h/week target.
- **Alex G** — Developer, 100% allocated to Eskom Modernisation Programme, 40h/week target.

---

## 3. Goals

### 3.1 Product goals
- **G1.** Provide a complete time-capture experience (weekly grid + timer) that is faster and more guided than Harvest. **[PARITY + ENHANCEMENT]**
- **G2.** Make the **timesheet the single source of truth**; all reporting, billing, and gamification derive only from approved/auto-approved data. **[ENHANCEMENT]**
- **G3.** Enforce **allocation- and compliance-aware validation** at capture and submission, not merely "40 hours = done". **[ENHANCEMENT]**
- **G4.** Deliver **approval-by-exception**: compliant timesheets auto-approve; only exceptions reach the PM queue. **[ENHANCEMENT]**
- **G5.** Govern all commercial behaviour (rates, billable status, overtime) from **project configuration**, never from user choice. **[ENHANCEMENT]**
- **G6.** Provide **native Azure DevOps work-item synchronisation** into timesheet drafts with mapping and audit. **[ENHANCEMENT]**
- **G7.** Provide an **AI productivity copilot** for capture, compliance, reporting, invoicing, and resource optimisation, with strict permission scoping and full auditability. **[ENHANCEMENT]**
- **G8.** Drive engagement and compliance through **gamification** (points, badges, streaks, leaderboards) where project rules always override. **[ENHANCEMENT]**
- **G9.** Provide PM/Finance **invoicing** with supporting annexures and immutable snapshots. **[PARITY + ENHANCEMENT]**
- **G10.** Provide **utilisation, productivity, capacity, and profitability** analytics at person, project, and portfolio level. **[PARITY + ENHANCEMENT]**
- **G11.** Ship a **pre-seeded UAT environment** so all flows are demonstrable immediately after deployment. **[ENHANCEMENT]**
- **G12.** Guarantee **immutable audit** of every state transition for enterprise/regulatory readiness. **[ENHANCEMENT]**

### 3.2 Success metrics (proposed; confirm targets at sign-off)
| Metric | Target |
|---|---|
| Auto-approval rate (compliant timesheets) | ≥ 85% of submitted timesheets |
| Timesheet on-time submission rate | ≥ 90% by Friday 16:00 |
| Time-to-capture a full week (median) | ≤ 5 minutes with AI/duplicate/DevOps assist |
| Allocation compliance (target-met weeks) | ≥ 90% across allocated consultants |
| Invoice generation cycle time | ≤ 1 working day from period close to draft |
| Billing accuracy (no double-billing, snapshot integrity) | 100% |
| Audit completeness (state transitions logged) | 100% |
| UAT readiness post-deploy (seed data present) | 100% of seed entities created |

---

## 4. Non-goals

- **NG1.** No payroll calculation/processing engine (payroll integration is in scope as an external integration; payroll computation is not).
- **NG2.** No general-purpose project/task scheduling (Gantt critical-path) beyond capacity/allocation planning described herein.
- **NG3.** No CRM / sales pipeline management beyond client master and contacts needed for billing.
- **NG4.** No accounting ledger / general ledger; INTRVL produces invoice-ready datasets and integrates outward, it is not an accounting system.
- **NG5.** No native mobile app in v1 (responsive web is in scope; native mobile is a future consideration).
- **NG6.** No custom AI model training/hosting; the AI copilot uses configured model providers.
- **NG7.** Expense tracking / receipt capture is **out of scope for v1** (Harvest has it; flagged as an Open Question for prioritisation — see §11).
- **NG8.** This PRD does not select the technology stack or define code/architecture (deferred to Architecture phase).

---

## 5. Functional Requirements

Requirements are grouped by engine. Each requirement has a stable ID (`FR-<engine>-<n>`). Tags: **[PARITY]**, **[ENHANCEMENT]**. Priority: **MUST**, **SHOULD**, **COULD** (MoSCoW). Where the requirements pack defines explicit rules, they are preserved verbatim in intent.

### 5.0 Cross-cutting governance rules (apply to all engines)
- **FR-GOV-1 (MUST) [ENHANCEMENT].** The **timesheet is the single source of truth**. All modules sync from it; no module may hold a conflicting master record.
- **FR-GOV-2 (MUST) [ENHANCEMENT].** **Project configuration overrides** user defaults, system defaults, and AI suggestions for all commercial decisions (billing rate, billable status, overtime allowance/multiplier/threshold, budget rules, contract terms, DevOps integration, approval workflow).
- **FR-GOV-3 (MUST) [ENHANCEMENT].** No state transition may occur unless: (1) validation rules pass, (2) the actor holds the required permission, (3) an audit record is created, (4) the previous state permits the transition, and (5) the transition is recorded in history.
- **FR-GOV-4 (MUST) [ENHANCEMENT].** Users control only: time capture, descriptions, submission, AI preferences, notification preferences. Users never decide commercial billing behaviour.
- **FR-GOV-5 (MUST).** Reporting and gamification consider **only approved or auto-approved** data; draft and rejected entries are excluded.

### 5.1 Identity & Access Management Engine
- **FR-IAM-1 (MUST) [PARITY].** Email/password login with validation of required fields; successful login loads role context, project assignments, allocations, and initialises AI agent context.
- **FR-IAM-2 (MUST) [PARITY].** Logout and session management with access/refresh tokens, configurable session timeout, and active-session registration.
- **FR-IAM-3 (MUST) [PARITY].** Reject invalid credentials; log failed-login event; increment failed-attempt counter; return authentication error.
- **FR-IAM-4 (MUST).** Block login for accounts in Disabled/Locked/Suspended state with an appropriate status message; invalidate all sessions on deactivation.
- **FR-IAM-5 (MUST).** Password management: temporary password on creation, forced reset on first login, password policy enforcement, reset flow.
- **FR-IAM-6 (SHOULD) [ENHANCEMENT].** Multi-factor authentication and conditional-access evaluation.
- **FR-IAM-7 (MUST) [ENHANCEMENT].** Role-based authorization resolving screen, API, feature, and administrative permissions; determine access scope (Self / Team / Department / Global); generate an effective permission set.
- **FR-IAM-8 (MUST).** Role-based screen access: deny disallowed screens, log a security event, and display "Access Denied"; apply data scope, feature, and edit permissions to allowed screens.
- **FR-IAM-9 (SHOULD) [ENHANCEMENT].** Identity federation: Keycloak and Azure AD integration, SSO, and user provisioning with attribute synchronisation (name, email, department, manager, employment type, security groups) and last-login update.
- **FR-IAM-10 (MUST) [ENHANCEMENT].** Security audit logging: record login events, authentication source, session info, device metadata, IP info, permission changes, and security events as immutable records.
- **FR-IAM-11 (MUST) [ENHANCEMENT].** Role context engine: determine persona (Administrator, PM, BA, Developer, Tester, Executive), load dashboard config, navigation structure, and AI context template; route to the correct dashboard.
- **FR-IAM-12 (MUST).** User provisioning flow: admin/PM creates user, assigns role/department/manager/team; provisioning engine creates identity, security profile, preferences, notification settings, and welcome invitation; **auto-provisions an AI agent** for the user.

### 5.2 Global Configuration Engine
- **FR-CFG-1 (MUST).** Country selection, timezone management, and regional work rules.
- **FR-CFG-2 (MUST) [PARITY].** Public holiday management: synchronisation, administration, and calendar maintenance; at least one holiday record must exist for UAT (South Africa default).
- **FR-CFG-3 (MUST) [ENHANCEMENT].** Workforce rules: work-week configuration, standard daily hours (default 8), standard weekly hours (default 40), overtime policies, and compliance thresholds.
- **FR-CFG-4 (SHOULD).** System configuration: notification settings, AI settings, scheduler settings.
- **FR-CFG-5 (MUST).** Work-calendar generation: when configuration changes, regenerate working days and holidays per user region and recalculate expected hours.

### 5.3 Workforce Management Engine
- **FR-WF-1 (MUST) [PARITY].** Manage employee, contractor, and service-provider profiles with full lifecycle (create, edit, deactivate, reactivate, offboard).
- **FR-WF-2 (MUST).** Capture worker details: name, email, role, department, manager, employment type, location; configure working rules (daily/weekly hours, working days, country, holiday calendar); activate worker.
- **FR-WF-3 (MUST).** Organisational structure: departments, teams, manager assignment, reporting lines, organisation hierarchy.
- **FR-WF-4 (SHOULD) [ENHANCEMENT].** Skills registry, skill assignment, proficiency levels (Beginner/Intermediate/Advanced/Expert), certifications, and a skills matrix.
- **FR-WF-5 (MUST) [ENHANCEMENT].** Capacity engine: determine standard capacity from working rules, subtract public holidays and approved leave, calculate available capacity, and publish availability.
- **FR-WF-6 (SHOULD) [ENHANCEMENT].** Workforce health: combine capacity, allocations, and timesheet data to compute utilisation, detect bench time, over-allocation, under-utilisation, and missing timesheets; produce a workforce health score.

### 5.4 Client Management Engine
- **FR-CLI-1 (MUST) [PARITY].** Client master records with code, contacts, status, currency, tax number, billing address.
- **FR-CLI-2 (MUST).** Commercial management: contract records, billing profiles, rate-card management.
- **FR-CLI-3 (SHOULD).** Client governance: reporting preferences, invoice preferences, client segmentation, document management, archival.
- **FR-CLI-4 (SHOULD) [ENHANCEMENT].** Client profitability analysis.
- **FR-CLI-5 (MUST).** Client lifecycle states: create → active → … → archived, with audit.

### 5.5 Project Portfolio Management Engine
- **FR-PRJ-1 (MUST) [PARITY].** Project creation wizard capturing name, code, client, description, project type (Time & Materials / Fixed Fee / Internal / Support-Managed Service).
- **FR-PRJ-2 (MUST).** **On create, persist immediately**, assign a unique Project ID, and set status to **DRAFT**. A newly created project is **not active**: no time logging, billing, or DevOps sync until status is ACTIVE.
- **FR-PRJ-3 (MUST) [ENHANCEMENT].** Project governance configuration: assign PM, status, start/end dates, priority, approval requirements.
- **FR-PRJ-4 (MUST) [ENHANCEMENT].** Financial configuration: budget hours, budget value, billing model, rate card, cost centre, revenue tracking; monthly budget reset rules; budget change process.
- **FR-PRJ-5 (MUST).** Workforce configuration: assign PM and team members, define project roles, configure allocations and capacity targets.
- **FR-PRJ-6 (MUST).** Work-type configuration: select available work types (Business Analysis, Development, Testing, Architecture, DevOps, Documentation, Project Management, Support, Internal Administration).
- **FR-PRJ-7 (MUST).** Task and subtask configuration: create tasks/subtasks with name, work type, budget, status, owner; tasks/subtasks appear in timesheet selection and inherit project context.
- **FR-PRJ-8 (MUST) [ENHANCEMENT].** Overtime configuration: overtime allowed (true/false), billable flag, multiplier, maximum threshold, approval-required flag. When disabled: block overtime billing, flag compliance breaches, disable overtime points.
- **FR-PRJ-9 (MUST) [ENHANCEMENT].** Azure DevOps configuration per project (organisation URL, project/board, PAT, assigned-user email, area-path & work-item-type mapping, auto-sync rules, active-status rules, estimate tracking).
- **FR-PRJ-10 (MUST) [ENHANCEMENT].** Compliance configuration: required descriptions, minimum-hours rules, submission rules, approval workflow, escalation rules, description quality rules.
- **FR-PRJ-11 (MUST).** Project validation engine: validate name, client existence, budget, PM assignment, dates, allocation rules, billing config, compliance config before activation.
- **FR-PRJ-12 (MUST).** Project creation engine: create project record, budget ledger, task structure, allocation framework, reporting structures, approval workflow, and audit record.
- **FR-PRJ-13 (MUST).** Project activation: publish; make available for allocation, timesheets, reporting, billing, AI context; notify assigned team.
- **FR-PRJ-14 (MUST).** Project lifecycle state machine: Draft → Configuring → Validating → Active → On Hold → Closed → Archived, enforced per state rules (see §9).
- **FR-PRJ-15 (SHOULD) [ENHANCEMENT].** Project workspace & progress analytics: overview dashboard, status/health indicators, budget consumption, burn-down (hours and cost), velocity, budget-exhaustion and completion forecasting, trend analysis.
- **FR-PRJ-16 (SHOULD) [ENHANCEMENT].** Financial visibility: billable/non-billable amounts, internal/labour cost, revenue forecast, profitability, margin, uninvoiced work.
- **FR-PRJ-17 (SHOULD) [ENHANCEMENT].** Portfolio management: multi-project oversight, portfolio budget/capacity/profitability/risk, cross-project resource conflicts, strategic dashboards.

### 5.6 Resource Allocation Engine
- **FR-ALLOC-1 (MUST) [ENHANCEMENT].** Allocate users to projects with project role, allocation %, start/end dates; store an allocation contract.
- **FR-ALLOC-2 (MUST) [ENHANCEMENT].** Calculate weekly and daily target hours from allocation % (e.g., 40h × 50% = 20h/week).
- **FR-ALLOC-3 (MUST) [ENHANCEMENT].** Validate total allocation ≤ 100%; **block** assignment that exceeds 100% and show conflict; allow under-allocation but flag under-utilisation.
- **FR-ALLOC-4 (SHOULD) [ENHANCEMENT].** Capacity planning, resource forecasting, demand planning, what-if scenarios.
- **FR-ALLOC-5 (SHOULD) [ENHANCEMENT].** Utilisation analysis: over-/under-allocation detection, bench management, allocation-adherence scoring, allocation-breach detection, utilisation reporting.
- **FR-ALLOC-6 (MUST).** Allocation snapshots for reporting (expected, allocated, actual, utilisation per week).

### 5.7 Leave & Absence Management Engine
- **FR-LEAVE-1 (MUST) [PARITY].** Capture leave (annual, sick, special, training) with request → approval/rejection → escalation workflow.
- **FR-LEAVE-2 (MUST).** On approval, update availability calendar, reduce expected hours, recalculate allocation targets, and notify affected PMs.
- **FR-LEAVE-3 (MUST).** Leave impact: in timesheets, display leave banner, reduce expected hours, adjust weekly compliance target, block AI auto-fill for leave periods, and suppress missing-hour warnings.
- **FR-LEAVE-4 (SHOULD).** Leave cancellation, bench-time management, leave calendar synchronisation, leave reporting.

### 5.8 Timesheet Capture Engine
- **FR-TS-1 (MUST) [PARITY].** Load timesheet context: current week, profile, allocations, active projects, tasks, work types, public holidays, approved leave, existing entries, timer sessions, gamification status.
- **FR-TS-2 (MUST) [PARITY].** Weekly grid (Mon–Sun) with daily hour capture, weekly/daily totals, and draft saving.
- **FR-TS-3 (MUST).** Time-entry management: project selection, task/subtask selection, work-type selection, description capture, hours entry, entry editing. **Only assigned, active projects appear**; unassigned projects are not selectable.
- **FR-TS-4 (MUST) [ENHANCEMENT].** Productivity assistance: display expected hours, allocation targets, project targets, weekly progress, and utilisation indicators.
- **FR-TS-5 (SHOULD) [PARITY].** Convenience: duplicate day, duplicate week (copy projects/tasks/work types/descriptions/hours), bulk updates; revalidate target after copy.
- **FR-TS-6 (MUST) [ENHANCEMENT].** Public-holiday alternative flow: display banner, reduce weekly expected hours, exclude from compliance checks, prevent AI auto-generation, allow manual entry if worked, disable entry fields by default.
- **FR-TS-7 (MUST) [ENHANCEMENT].** Approved-leave alternative flow: display banner, reduce expected hours, adjust compliance target, block AI auto-fill, prevent missing-hour warnings.
- **FR-TS-8 (MUST).** Real-time validation on entry against the Master Validation Rules (see §5.10 and Appendix A).
- **FR-TS-9 (MUST).** Timesheet status surface: Draft, In Progress, Validation Warning, Compliant, Ready for Submission.

### 5.9 Timer Tracking Engine
- **FR-TIMER-1 (MUST) [PARITY].** Start/stop timer with active-session tracking; assign project, task, work type, and description.
- **FR-TIMER-2 (MUST) [PARITY].** Rounding engine: round to nearest 15 / 30 / 60 minutes, applied per user or project configuration.
- **FR-TIMER-3 (MUST).** On stop, create a timesheet entry and update daily/weekly totals, then run validation.

### 5.10 Compliance & Validation Engine
- **FR-VAL-1 (MUST).** Hours validation: hours > 0 and ≤ 24 (block); detect missing and excess hours.
- **FR-VAL-2 (MUST).** Required-field validation: project required (block); task required when project enforces tasks (block); description mandatory (block); minimum description length and action-content quality (block if below threshold).
- **FR-VAL-3 (MUST).** Data-quality validation: no overlapping entries per user/day (block); duplicate-entry detection (block); missing-data detection.
- **FR-VAL-4 (MUST) [ENHANCEMENT].** Allocation validation: validate weekly hours against PM-defined allocation targets per project (not just total = 40h); flag allocation breach; in strict mode, block over-allocation.
- **FR-VAL-5 (MUST) [ENHANCEMENT].** Overtime validation: detect daily overtime; if project allows overtime, mark approved overtime (or pending approval if approval required); if not allowed, flag compliance violation and require PM review; enforce maximum overtime threshold (block when exceeded).
- **FR-VAL-6 (MUST).** Project-state validation: only ACTIVE projects accept time (block for Draft/inactive); unassigned user logging time (block).
- **FR-VAL-7 (MUST) [ENHANCEMENT].** Description quality: configurable minimum (e.g., ≥ 20 characters and contains an action description); reject placeholder text ("Meeting", "Dev work", "Testing").
- **FR-VAL-8 (MUST).** Compliance scoring and trend analysis; compliance exception management, escalation, and override process (override is itself audited).
- **FR-VAL-9 (MUST).** Locked entries are immutable (block edits); audit record required for every action (block on audit failure).

> The complete, authoritative validation matrix (35 rules incl. block/no-block) is captured in **Appendix A — Master Validation Rules**.

### 5.11 Approval Workflow Engine (Approval-by-Exception)
- **FR-APR-1 (MUST) [ENHANCEMENT].** On submission, run the validation engine and route accordingly: all conditions met → **auto-approve**, lock, queue downstream sync (e.g., Harvest), notify PM (information only), notify user; any condition failed → route to **PM approval queue** and block auto-approval.
- **FR-APR-2 (MUST) [ENHANCEMENT].** Auto-approval conditions: project allocation targets met; weekly expected hours met; daily hours complete; description exists for every working day and meets quality rules; no compliance violations; no allocation breach; overtime rules complied with; no missing entries; no validation errors.
- **FR-APR-3 (MUST).** PM approval actions: approve / reject / return with comments; rejected timesheets become editable and re-enter validation on resubmit.
- **FR-APR-4 (MUST) [ENHANCEMENT].** Overtime exception rule: even when weekly target is met, extra hours must satisfy project overtime rules or the timesheet requires PM approval.
- **FR-APR-5 (MUST) [ENHANCEMENT].** PM dashboard shows only exceptions plus counts: auto-approved, awaiting approval, rejected, returned, and auto- vs manual-approval rate.
- **FR-APR-6 (MUST).** Escalation management: escalation routing, reminders, SLA tracking; workflow audit trail and decision history.

### 5.12 Azure DevOps Automation Engine
- **FR-ADO-1 (MUST) [ENHANCEMENT].** DevOps configuration & handshake: build auth header, encode PAT, connect, validate organisation and PAT permissions, retrieve user profile, available projects, boards, work-item types, and workflow statuses; report SUCCESS or detailed FAILURE (auth failed / permission denied / invalid PAT / invalid org / project not found).
- **FR-ADO-2 (MUST) [ENHANCEMENT].** User identity validation: compare Azure DevOps user with INTRVL user; on mismatch, warn, require confirmation, and log an audit event.
- **FR-ADO-3 (MUST) [ENHANCEMENT].** Active-status configuration: retrieve available statuses; user defines which statuses count as active (e.g., Active, In Progress, Development, Testing, UAT, Reopened); exclude Closed/Done/Cancelled/Removed/Rejected/Deferred.
- **FR-ADO-4 (MUST) [ENHANCEMENT].** Manual refresh: connect, query assigned work items, retrieve ticket numbers, titles, statuses, estimates, remaining work, assigned user; normalise to `Project | Ticket Number | Status | Description`; apply active-status filter and mapping rules/overrides; build preview entries.
- **FR-ADO-5 (MUST) [ENHANCEMENT].** Mapping engine: area-path mapping, work-item mapping, manual overrides, and mapping learning; flag unmapped tickets (warning, no block).
- **FR-ADO-6 (MUST) [ENHANCEMENT].** Description generation: `[Ticket Number] - [Description]` template; generate human-readable descriptions preserving ticket traceability.
- **FR-ADO-7 (MUST) [ENHANCEMENT].** Entry preview & user review: accept all / edit / skip / change work type / change task / change description / save mapping override; populate draft timesheet entries with estimate metadata and ticket reference.
- **FR-ADO-8 (SHOULD) [ENHANCEMENT].** Scheduled refresh per project configuration; generate notification summary (retrieved / added / updated / skipped) and store refresh history.
- **FR-ADO-9 (MUST) [ENHANCEMENT].** Automation reporting: coverage analysis, mapping health, estimate-vs-actual, and synchronisation audit history.
- **FR-ADO-10 (MUST).** Connection state machine (Not Configured → Configuring → Testing → Connected → Failed → Disabled) and refresh state machine (Pending → Running → Completed / Completed-with-Warnings / Failed). Connected is required before refresh; failed integrations cannot schedule jobs.

### 5.13 AI Productivity Assistant (Copilot) Engine
- **FR-AI-1 (MUST) [ENHANCEMENT].** Auto-provision an AI agent for every user at creation: AI profile, memory store, role prompt, permission context, preferences, productivity profile.
- **FR-AI-2 (MUST) [ENHANCEMENT].** Load AI role context at login (role, projects, allocations, utilisation/compliance targets, reporting/security permissions); AI must enforce permissions (deny out-of-scope requests, explain, and audit).
- **FR-AI-3 (MUST) [ENHANCEMENT].** Timesheet assistance: identify missing periods, generate suggested entries and descriptions, fill missing hours — **without exceeding allocation targets** (unless approved overtime exists), **never** generating work on public holidays or approved leave.
- **FR-AI-4 (MUST) [ENHANCEMENT].** Description generation/improvement that references project and work-type context and meets minimum quality requirements while preserving meaning.
- **FR-AI-5 (MUST) [ENHANCEMENT].** Compliance assistance: identify missing hours/variance, allocation breaches, and overtime violations; recommend corrective actions; validate before submission and explain submission failures.
- **FR-AI-6 (SHOULD) [ENHANCEMENT].** DevOps assistance: interpret tickets, identify mappings/types/status, generate descriptions, and flag unmapped tickets.
- **FR-AI-7 (SHOULD) [ENHANCEMENT].** Project, resource, reporting, and invoicing assistance: health analysis, budget-risk detection, under/over-utilisation recommendations, executive summaries, anomaly explanations, invoice summaries/risk detection.
- **FR-AI-8 (COULD) [ENHANCEMENT].** Voice copilot: speech-to-text, intent detection, permission validation, and action execution (e.g., "Log four hours to Eskom development", "Submit my timesheet", "Show project health").
- **FR-AI-9 (MUST) [ENHANCEMENT].** AI memory/learning: capture frequently used projects, preferred work types, common descriptions/reports/commands, and preferences; improve suggestions while preserving user control.
- **FR-AI-10 (MUST) [ENHANCEMENT].** AI audit & governance: record user, timestamp, prompt, response (and voice transcript if applicable), suggested action, executed action, result, and security context; recommendations must be traceable (what/when/who-accepted/changes-applied).
- **FR-AI-11 (MUST).** AI request state machine (Submitted → Processing → Completed / Failed / Cancelled) with user-friendly failure explanations and suggested resolution.
- **FR-AI-12 (SHOULD).** Persistent copilot available across Dashboard, Timesheets, Projects, Capacity, Reporting, DevOps, Invoicing, Administration, and User Profile, with chat, voice, suggestions, and smart actions; proactive background analysis at session start.

### 5.14 Notification & Reminder Engine
- **FR-NOT-1 (MUST) [PARITY].** In-app, email, and Teams notifications.
- **FR-NOT-2 (MUST).** Reminder services: daily, weekly, and compliance reminders; missing-hours and submission reminders; late-submission escalation.
- **FR-NOT-3 (MUST).** Workflow notifications: approval, rejection, escalation; manager-escalation notification.
- **FR-NOT-4 (MUST).** Exception notifications: submission failures, integration (DevOps/Harvest) failures, compliance breaches, budget thresholds.
- **FR-NOT-5 (SHOULD).** Event notifications: badge award, leaderboard, invoice approval.
- **FR-NOT-6 (MUST).** Notification state machine (Queued → Sent → Delivered → Read; Sent → Failed → Sent on retry) and templates.

### 5.15 Auto Submission Engine
- **FR-AUTO-1 (MUST) [ENHANCEMENT].** Scheduling: submission scheduling, cron configuration, auto-submit windows (default Friday 16:00).
- **FR-AUTO-2 (MUST).** Pre-submission validation: expected hours met, no missing descriptions/entries, no compliance breaches, completeness check.
- **FR-AUTO-3 (MUST).** On eligible: submit, lock, award submission points, notify user. On ineligible: block submission, create failure notification, show header alert "Submission Failed", list validation errors, notify user.
- **FR-AUTO-4 (MUST).** Audit tracking: submission logging, failure logging, schedule history.

### 5.16 Billing & Revenue Intelligence Engine
- **FR-BILL-1 (MUST) [ENHANCEMENT].** Billing classification: identify billable vs non-billable hours, detect overrun hours, classify compliance-based billing status.
- **FR-BILL-2 (MUST) [ENHANCEMENT].** Revenue leakage detection: unapproved-overtime tracking, underutilisation costing, margin-impact analysis.
- **FR-BILL-3 (MUST).** Client billing output: generate invoice-ready datasets, flag safe-to-bill hours, export billing summaries.
- **FR-BILL-4 (MUST) [ENHANCEMENT].** Billable-hours calculation multiplies approved hours by the **project rate** (project rate card first, user default rate fallback); overtime separated and applied only when the project allows it.

### 5.17 Rate Management Engine
- **FR-RATE-1 (MUST) [ENHANCEMENT].** Cost-rate and billing-rate configuration with effective dates and historical preservation.
- **FR-RATE-2 (MUST) [ENHANCEMENT].** Rate-change approval, project rate override, client rate override, rate audit trail, rate impact analysis.
- **FR-RATE-3 (MUST).** Rate determination: when a user is assigned to a project, use the project rate card if present, else the user's default billing rate. **Project rules always take precedence.**

### 5.18 Invoice Generation & Receivables Engine
- **FR-INV-1 (MUST) [PARITY].** Invoice workbench showing client, project, contract type, budget, total billable hours, approved overtime, current/uninvoiced value, and invoice history.
- **FR-INV-2 (MUST).** Invoice period configuration: accounting period, project period, invoice date, currency, payment terms, billing period; validate project/client active, billing enabled, rates configured, timesheets exist.
- **FR-INV-3 (MUST) [ENHANCEMENT].** Billable-hours extraction: include approved/submitted/compliant/billable entries and approved overtime; exclude draft, rejected, leave, public holidays, internal activities, non-billable, and compliance violations.
- **FR-INV-4 (MUST).** Resource billing (standard hours × consulting rate) and overtime billing (overtime hours × overtime rate, validated: project allows overtime, approved, billable, compliant).
- **FR-INV-5 (MUST) [ENHANCEMENT].** Task consolidation: group submitted descriptions by work type into a client activity summary.
- **FR-INV-6 (MUST).** Invoice preview with sections: standard professional services, approved overtime, project activity summary, and financial summary (subtotal, VAT, total due).
- **FR-INV-7 (MUST) [ENHANCEMENT].** Supporting evidence: timesheet entries, descriptions, overtime approvals, rates, audit trail, calculations.
- **FR-INV-8 (MUST).** Invoice validation: rates/client/billing-contact exist, hours reconciled, overtime approved, no duplicate billing, VAT calculated, project active.
- **FR-INV-9 (MUST) [ENHANCEMENT].** Draft auto-synchronisation: future timesheet changes update draft hours, costs, activity summary, overtime totals, and value.
- **FR-INV-10 (MUST).** Finance review (approve/reject/request-adjustment/return) then issue: generate PDF invoice and annexures (timesheet, activity summary, overtime, audit ledger, billing dataset).
- **FR-INV-11 (MUST) [ENHANCEMENT].** On issue, create an **immutable snapshot** (timesheet, rate, project, activity, financial) and lock the invoice; prevent double billing via invoice-entry links.
- **FR-INV-12 (MUST).** Invoice state machine: Draft → Generated → Approved → Sent → Partially Paid → Paid → Archived (and Cancelled), with paid invoices immutable and cancelled invoices retained for audit.
- **FR-INV-13 (SHOULD).** Receivables: payment receipt, partial payment, allocation/settlement, overdue detection, reminder cycle, credit note, supplementary invoice, write-off, receivables reporting.

### 5.19 Reporting & Analytics Engine
- **FR-REP-1 (MUST) [PARITY].** Operational reporting: timesheet, utilisation, allocation reports.
- **FR-REP-2 (MUST).** Financial reporting: revenue, budget, billing reports; overtime as a separate line item.
- **FR-REP-3 (MUST).** Compliance reporting: validation, overtime, audit reports.
- **FR-REP-4 (SHOULD) [ENHANCEMENT].** Executive reporting: portfolio dashboards, KPI reporting, forecast reporting.
- **FR-REP-5 (MUST) [ENHANCEMENT].** Utilisation/productivity/capacity metrics (see Appendix B for formulas): billable utilisation, productivity, capacity usage, allocation achievement, health bands.
- **FR-REP-6 (MUST).** **Reporting reflects only approved/auto-approved data**; real-time refresh on approval; manual refresh re-fetches latest approved data with no stale cache.
- **FR-REP-7 (SHOULD) [ENHANCEMENT].** Drill-down (Project → Resource → Task → Time Entry; Ticket → Time Entry; Invoice → Time Entry); filters; saved/shared reports; report builder.
- **FR-REP-8 (SHOULD).** DevOps delivery analytics: ticket coverage, estimate-vs-actual, throughput, aging, blocked work, sprint contribution.

### 5.20 Visualization / Dashboards Engine
- **FR-VIZ-1 (SHOULD) [ENHANCEMENT].** Executive dashboards (revenue, utilisation, compliance), operational dashboards (productivity heatmaps, allocation, capacity), financial dashboards (margin, budget, revenue forecast), and Azure DevOps dashboards (coverage, mapping health, estimate-vs-actual).
- **FR-VIZ-2 (SHOULD) [ENHANCEMENT].** Person view, project view, project team tab, utilisation leaderboard, and executive dashboard as described in the requirements pack (Appendix B references).

### 5.21 Gamification & Engagement Engine
- **FR-GAM-1 (MUST) [ENHANCEMENT].** Points management for valid time entries (+5), daily completion (+20), allocation achievement (100%→+50, 95–99%→+30, 90–94%→+15), billable productivity (100%→+100, 95%→+75, 90%→+50, 80%→+25), on-time submission (early +50, on-time +40, auto +30), DevOps activity (+10 each: refresh/review/accept), overtime (+20 only if project allows), full compliance week (+100). Points only after approval.
- **FR-GAM-2 (MUST) [ENHANCEMENT].** **Project rules override all gamification scoring** — overtime never earns points unless the project explicitly allows overtime.
- **FR-GAM-3 (SHOULD) [ENHANCEMENT].** Achievements/badges, milestones, streaks (Bronze/Silver/Gold/Platinum/Diamond), levels (Associate → Master), and named badges per the requirements pack.
- **FR-GAM-4 (SHOULD) [ENHANCEMENT].** Leaderboards: global, role, team, project, compliance, productivity, DevOps automation, and streak; configurable period and scope; tie-break rules; visibility rules by role; refresh schedule.
- **FR-GAM-5 (MUST).** Real-time score updates after approval; badge award process (verify criteria, no duplicate award, award points, update profile/leaderboard, audit); badge revocation when a streak-based criterion breaks; in-timesheet celebration popups and header showcase.
- **FR-GAM-6 (MUST).** Badge and leaderboard state machines (see §9).

### 5.22 External Integration Framework
- **FR-INT-1 (SHOULD) [ENHANCEMENT].** Productivity integrations: Azure DevOps (native, §5.12), Harvest, Outlook, Teams.
- **FR-INT-2 (SHOULD).** Enterprise integrations: HR, payroll, ERP systems (outbound datasets).
- **FR-INT-3 (MUST) [ENHANCEMENT].** Harvest synchronisation engine: authentication, connection validation, submission, retry logic, response processing, reconciliation, failure recovery, audit logging, scheduled submission, status monitoring.
- **FR-INT-4 (SHOULD).** Integration services: API framework, webhooks, retry management; integration monitoring (health, failure tracking, sync analytics).

### 5.23 Audit & Governance Engine
- **FR-AUD-1 (MUST) [ENHANCEMENT].** Immutable audit ledger: audit record creation, version history, change tracking, immutable storage.
- **FR-AUD-2 (MUST).** Compliance auditing: user-activity, approval, and integration auditing.
- **FR-AUD-3 (MUST).** Governance controls: policy enforcement, compliance reporting, audit reporting.
- **FR-AUD-4 (SHOULD).** Historical analysis: event reconstruction, timeline analysis, evidence reporting; audit query/export/retention; regulatory audit-pack generation; invoice and timesheet snapshot creation.

### 5.24 Administration & Platform Operations Engine
- **FR-ADM-1 (MUST).** Platform administration: user, configuration, and environment administration.
- **FR-ADM-2 (MUST).** Scheduler administration: job monitoring, execution history, scheduler configuration.
- **FR-ADM-3 (SHOULD).** Platform monitoring: health dashboards, performance and availability monitoring.
- **FR-ADM-4 (SHOULD).** Operational resilience: backup management, disaster recovery, data-retention management.

### 5.25 Export & Distribution Engine
- **FR-EXP-1 (MUST) [PARITY].** PDF, Excel, and CSV exports.
- **FR-EXP-2 (SHOULD).** Report scheduling and distribution, email delivery, share-link generation, Power BI export, data-warehouse export, archive export, stakeholder subscriptions.
- **FR-EXP-3 (MUST).** Exports include audit traceability (timestamps, approval status, data-source references).

### 5.26 Exception Management Engine
- **FR-EXC-1 (MUST) [ENHANCEMENT].** Exception detection, classification, and routing (manager/finance/compliance review).
- **FR-EXC-2 (MUST).** Override, resolution, escalation, and closure processes; exception reporting; exception state machine.

### 5.27 Pre-Seeded UAT Environment (Initial Environment Configuration)
- **FR-SEED-1 (MUST) [ENHANCEMENT].** On deployment, provision default users, projects, allocations, work types, tasks, holidays, gamification, and Azure DevOps configuration so all flows are immediately testable.
- **FR-SEED-2 (MUST).** Seed users (all password `Welcome@123`, forced reset on first login):
  - **Connor C** (ConnorC@agilebridge.co.za) — Project Manager, Delivery; permissions: project management, resource allocation, timesheet approval, reporting, compliance overrides, budget management; no allocation.
  - **Justice J** (JusticeJ@agilebridge.co.za) — Business Analyst, Delivery; permissions: time capture, timer, AI assistant, Azure DevOps integration, personal reporting; allocated 100% to Eskom Modernisation Programme, 40h/week; work types: Business Analysis, Requirements Gathering, Workshop Facilitation, Documentation, Testing Support.
  - **Alex G** (AlexG@agilebridge.co.za) — Developer, Engineering; permissions: time capture, timer, Azure DevOps integration, personal reporting; allocated 100% to Eskom Modernisation Programme, 40h/week; work types: Development, Bug Fixing, Code Review, Testing, DevOps.
- **FR-SEED-3 (MUST).** Seed client **Eskom** (Active, Time & Materials, ZAR).
- **FR-SEED-4 (MUST).** Seed project **Eskom Modernisation Programme** (ESK-001, client Eskom, Active, budget 5,000 hours, overtime allowed, approval required, PM Connor C) with seed tasks (Requirements Analysis, Stakeholder Workshops, Functional Specifications, User Story Definition, Feature Development, Bug Fixing, Code Review, Unit Testing, Project Meetings, Status Reporting, Documentation, Support Activities).
- **FR-SEED-5 (MUST).** Seed default work types (Business Analysis, Development, Testing, Architecture, DevOps, Documentation, Support, Project Management, Internal Administration).
- **FR-SEED-6 (MUST).** Seed public-holiday configuration (South Africa, Mon–Fri, 8h/day, 40h/week, auto-synced, ≥1 holiday record for testing).
- **FR-SEED-7 (MUST).** Seed gamification configuration (points/achievements/leaderboards enabled; rules: on-time submission, allocation achievement, full utilisation, approved overtime, compliance achievement).
- **FR-SEED-8 (MUST).** Seed a sample Azure DevOps configuration (Enabled; area path `Eskom\Digital`; work-item types User Story, Task, Bug) to demonstrate sync, mapping, and estimate-vs-actual.
- **FR-SEED-9 (MUST).** Expected post-deploy outcome: Connor can manage projects; Justice can log time against Eskom; Alex can sync Azure DevOps items; project active; allocations exist; timesheets submittable; approval testable; reporting generatable; gamification and Azure DevOps demonstrable with no extra setup.

---

## 6. Non-functional Requirements

- **NFR-1 Security & Access.** RBAC with Self/Team/Department/Global scopes; financial data protected from non-finance roles; optional MFA; federation (Keycloak/Azure AD) and SSO; encrypted storage of secrets (PAT tokens, credentials); all security events audited.
- **NFR-2 Auditability.** 100% of state transitions produce immutable audit records meeting FR-GOV-3; audit data is queryable, exportable, and retained per policy for regulatory audit packs.
- **NFR-3 Data Integrity.** Timesheet is the single source of truth; no duplicate or overlapping entries; locked/approved/paid records immutable; double-billing prevented via invoice-entry links.
- **NFR-4 Performance.** Timesheet grid loads ≤ 2s for a typical week; validation feedback is real-time (≤ 300ms perceived); reports reflect latest approved data without stale cache. (Confirm exact SLAs at sign-off.)
- **NFR-5 Availability & Resilience.** Target ≥ 99.5% availability; backup, disaster recovery, and data-retention management; integration retries with failure recovery.
- **NFR-6 Scalability.** Support multi-client, multi-project portfolios and concurrent consultants; scheduler/auto-submission and DevOps refresh jobs run without blocking interactive use.
- **NFR-7 Usability & Accessibility.** Responsive web UI; role-aware navigation and dashboards; guided capture (expected hours, targets, banners); WCAG 2.1 AA target.
- **NFR-8 Internationalisation.** Country/timezone/holiday-aware; multi-currency (ZAR default for UAT); localisable date and number formats.
- **NFR-9 Configurability.** Project-governed commercial rules; configurable validation thresholds, description-quality rules, overtime policy, rounding rules, auto-submission windows, and gamification weightings.
- **NFR-10 Integration Reliability.** Azure DevOps and Harvest handshakes validated before use; clear, user-friendly failure messages with recovery guidance; integration health monitoring.
- **NFR-11 AI Safety & Governance.** AI enforces role permissions, never exceeds allocation or generates on holidays/leave, is fully audited and traceable, and degrades gracefully with user-friendly explanations on failure.
- **NFR-12 Observability.** Health dashboards, performance/availability monitoring, job execution history, and structured error reporting with recovery guidance.
- **NFR-13 Compliance & Privacy.** Personal data handled per applicable privacy regulation (e.g., POPIA/GDPR); access logging; least-privilege.
- **NFR-14 Maintainability.** Modular engine boundaries; state machines centrally enforced; configuration over hard-coding.

---

## 7. Acceptance Criteria

Acceptance criteria are expressed as Gherkin-style scenarios traceable to the requirements pack. They are organised by area; this is the authoritative sign-off set (the full enterprise Gherkin spec from the requirements pack is incorporated by reference and summarised here).

### 7.1 Identity, Access & User Management
- **AC-IAM-1.** *Given* a registered user, *when* valid credentials are entered, *then* access is granted and role context, project assignments, allocations, and AI context load.
- **AC-IAM-2.** *Given* invalid credentials, *when* login is attempted, *then* access is denied, an error is shown, and a security audit event is logged.
- **AC-IAM-3.** *Given* a disabled/locked account, *when* login is attempted, *then* access is blocked with a status message.
- **AC-IAM-4.** *Given* a non-finance user, *when* they attempt to access invoicing data, *then* access is denied and an audit event is recorded.
- **AC-IAM-5.** *Given* a PM creates a user with a duplicate email or no role, *then* creation is blocked with the relevant error.
- **AC-IAM-6.** *Given* a new user is created, *when* provisioning completes, *then* an AI agent is provisioned with role-aware context and a temporary password forces reset on first login.

### 7.2 Project & Commercial Configuration
- **AC-PRJ-1.** *Given* valid project details, *when* the PM clicks Create, *then* the project is persisted immediately with a unique ID and status DRAFT.
- **AC-PRJ-2.** *Given* a newly created (non-active) project, *then* time logging, billing, and DevOps sync are not permitted until status is ACTIVE.
- **AC-PRJ-3.** *Given* required fields are missing, *when* creation is attempted, *then* creation is blocked and missing fields highlighted.
- **AC-PRJ-4.** *Given* a project with overtime disabled, *when* a user logs > 8 hours, *then* a violation is flagged and routed to compliance.
- **AC-PRJ-5.** *Given* a user assigned to a project, *when* billing rate is required, *then* the project rate card is used first and the user default rate as fallback.

### 7.3 Allocation
- **AC-ALLOC-1.** *Given* a user assigned at 50% allocation, *then* expected hours = 8h/day × 50% and weekly expected hours are generated.
- **AC-ALLOC-2.** *Given* total allocation would exceed 100%, *when* assignment is attempted, *then* it is blocked with an allocation conflict.
- **AC-ALLOC-3.** *Given* a user assigned below capacity, *then* assignment is allowed but under-utilisation is flagged.

### 7.4 Timesheet Capture & Calendar
- **AC-TS-1.** *Given* a user assigned to a project, *when* time is entered with a description, *then* the entry is recorded and validated against allocation rules.
- **AC-TS-2.** *Given* a public holiday in the user region, *when* the grid loads, *then* the holiday is shown, entry fields disabled, and expected hours recalculated.
- **AC-TS-3.** *Given* approved leave, *when* the grid loads, *then* a leave banner shows, expected hours reduce, AI auto-fill is blocked, and missing-hour warnings are suppressed.
- **AC-TS-4.** *Given* a valid entry, *when* the user duplicates a day/week, *then* projects/tasks/work types/descriptions/hours copy and the target revalidates.
- **AC-TS-5.** *Given* only assigned projects, *then* the timesheet shows only those projects and hides all others.

### 7.5 Timer
- **AC-TIMER-1.** *Given* a timer session, *when* the user stops it, *then* the system prompts for rounding (15/30/60 min) and applies the user/project rule, creating a final entry.
- **AC-TIMER-2.** *Given* a project defines rounding = 30 minutes, *then* logged time is rounded to the nearest 30 minutes and stored as the final entry.

### 7.6 Validation & Compliance
- **AC-VAL-1.** *Given* hours ≤ 0 or > 24, overlapping entries, missing project/required-task/description, or too-short description, *when* validation runs, *then* submission is blocked with the specific message (per Appendix A).
- **AC-VAL-2.** *Given* PM-defined allocation targets (e.g., Eskom 20h, Transnet 12h, Internal 8h), *when* logged hours match the distribution, *then* validation passes; if a target is missed, the timesheet requires PM approval.
- **AC-VAL-3.** *Given* a project that does not allow overtime, *when* hours exceed the threshold, *then* an overtime violation is flagged and routed for PM approval.
- **AC-VAL-4.** *Given* a description like "Meeting" or "Dev work", *then* the description-quality rule fails and the entry is flagged for correction.

### 7.7 Submission & Approval (by Exception)
- **AC-APR-1.** *Given* all expected hours met, all working days described, no compliance violations, and overtime rules respected, *when* the user submits, *then* the timesheet auto-approves, locks, and the PM is notified informationally.
- **AC-APR-2.** *Given* any validation rule fails, *when* submitted, *then* the timesheet routes to the PM approval queue and auto-approval is blocked.
- **AC-APR-3.** *Given* Friday 16:00, *when* the scheduler runs, *then* all valid timesheets submit automatically; ineligible ones are not submitted and a failure notification + header alert is generated.
- **AC-APR-4.** *Given* a rejected timesheet, *when* the user edits and resubmits, *then* it re-enters validation.

### 7.8 Azure DevOps Integration
- **AC-ADO-1.** *Given* a user configures org URL, project, and PAT, *when* the handshake runs, *then* a valid connection, user, and accessible project are confirmed (or a specific failure is returned).
- **AC-ADO-2.** *Given* integration is active, *when* refresh is triggered, *then* active tickets are retrieved and normalised to `Project | Ticket Number | Status | Description`.
- **AC-ADO-3.** *Given* tickets retrieved, *then* only configured active statuses are accepted and inactive/resolved tickets are excluded.
- **AC-ADO-4.** *Given* a ticket cannot be mapped, *then* the mapping gap is flagged (warning) and the user is notified.
- **AC-ADO-5.** *Given* mapped tickets, *when* the user accepts the preview, *then* draft entries populate with ticket reference, work type, task, description, and estimate metadata.

### 7.9 AI Copilot
- **AC-AI-1.** *Given* a new user, *when* provisioning completes, *then* an AI agent is created with role context and permissions.
- **AC-AI-2.** *Given* a Developer requests financial reporting, *then* the AI denies access, explains insufficient permissions, and records an audit event.
- **AC-AI-3.** *Given* a public holiday or approved leave, *when* AI generates entries, *then* no work is generated for those days.
- **AC-AI-4.** *Given* an allocation of 50% to a project, *when* AI generates suggestions, *then* generated hours do not exceed the allocation target unless approved overtime exists.
- **AC-AI-5.** *Given* an AI action occurs, *then* user, timestamp, prompt, response, action taken, and outcome are recorded and traceable.

### 7.10 Billing & Invoicing
- **AC-BILL-1.** *Given* approved billable hours, *when* the billing engine runs, *then* billable hours × project rate is calculated and overtime is separated (applied only if the project allows it).
- **AC-INV-1.** *Given* approved billable time, *when* the PM generates an invoice, *then* a draft is created grouping hours by person and project with role-based rates and a task/activity summary.
- **AC-INV-2.** *Given* a finalised invoice, *when* export is triggered, *then* a legal PDF invoice plus annexures are generated.
- **AC-INV-3.** *Given* an issued invoice, *then* an immutable snapshot is created and the invoice is locked; the same entries cannot be billed twice.

### 7.11 Reporting & Analytics
- **AC-REP-1.** *Given* multiple timesheet states, *when* reports are generated, *then* only approved/auto-approved entries are included; drafts and rejected entries are excluded.
- **AC-REP-2.** *Given* a timesheet is approved, *when* approval completes, *then* reporting updates without manual refresh.
- **AC-REP-3.** *Given* utilisation reporting, *then* utilisation = billable hours ÷ workable hours (excluding holidays and leave), computed per Appendix B.

### 7.12 Gamification
- **AC-GAM-1.** *Given* a timesheet is approved/auto-approved on time and compliant, *then* the user earns the corresponding compliance/punctuality points (only after approval).
- **AC-GAM-2.** *Given* a project disallows overtime, *when* overtime is logged, *then* no overtime points are awarded and a compliance flag is logged.
- **AC-GAM-3.** *Given* a rejected timesheet, *then* no points are awarded and the rejection reason is logged.

### 7.13 Audit & System Rule
- **AC-AUD-1.** *Given* any system action, *when* processing completes, *then* an immutable audit record is created.
- **AC-SYS-1.** *Given* multiple modules update data, *then* the timesheet remains the master record and all modules sync from it.

### 7.14 UAT Seed
- **AC-SEED-1.** *Given* deployment completes, *then* Connor/Justice/Alex, the Eskom client, the ESK-001 project (Active), allocations, work types, tasks, ≥1 public holiday, gamification config, and a sample Azure DevOps config all exist, and every primary flow is demonstrable without additional setup.

---

## 8. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Scope is XL** (20+ engines, ~120 files) — overrun. | High | High | Phase delivery by engine; MUST-first MoSCoW; gate via Epics/Stories; treat enhancements (AI/voice) as later increments. |
| R2 | **Azure DevOps API** changes, rate limits, or PAT/permission issues. | Med | High | Robust handshake validation, retries, clear failures; abstract the integration; cache normalised data. |
| R3 | **PAT/credential storage** security exposure. | Med | High | Encrypt at rest, least-privilege, audit access, never log secrets. |
| R4 | **AI copilot** generating non-compliant entries or leaking data across roles. | Med | High | Hard permission gate, allocation/holiday/leave guards, full audit, human-in-the-loop accept/modify/reject. |
| R5 | **Approval-by-exception** misconfiguration auto-approving bad data. | Med | High | Conservative defaults, strict validation, full audit, PM override visibility, configurable strict mode. |
| R6 | **Single-source-of-truth** violations from module drift. | Med | High | Enforce FR-GOV-1/3; derive all reads from approved data; state-machine governance. |
| R7 | **Billing accuracy / double-billing**. | Low | High | Invoice-entry links, immutable snapshots, reconciliation, finance review gate. |
| R8 | **Gamification gaming** (points without genuine compliance). | Med | Med | Points only after approval; project-rule override; audit; utilisation leaderboard separate from points. |
| R9 | **Stack not specified** — architectural rework risk. | Med | Med | Resolve in Architecture phase; PRD stays implementation-agnostic. |
| R10 | **Multi-integration reliability** (Harvest, Outlook, Teams, HR/Payroll/ERP). | Med | Med | Prioritise Azure DevOps + Harvest; integration health monitoring; phased rollout. |
| R11 | **Data privacy/regulatory** (POPIA/GDPR) for personal and client data. | Med | High | Privacy-by-design, access logging, retention policy, audit packs. |
| R12 | **Performance** of real-time validation and live reporting at scale. | Med | Med | Define SLAs; index/aggregate; async jobs for refresh/sync. |

---

## 9. State Machines (authoritative reference)

State machines are first-class requirements (governed by FR-GOV-3). The following are in scope and must be enforced centrally:

- **Timesheet:** Draft → Validating → Submitted → (Auto-Approved | Pending Approval) → Approved/Rejected → Locked → Synced → Archived. Draft editable; Validating/Pending/Approved/Auto-Approved/Locked/Synced read-only or immutable as specified.
- **Timesheet Entry:** Draft → Validated → Approved/Rejected → Locked.
- **Project:** Draft → Configuring → Validating → Active → On Hold → Closed → Archived (with per-state rules: Draft = exists only; Configuring = assign/configure; Active = logging/reporting/billing/DevOps enabled; Closed = no new entries, invoices/reports remain; Archived = read-only).
- **User:** Invited → Active → Disabled/Locked/Terminated (with reactivation/unlock transitions).
- **Azure DevOps Connection:** Not Configured → Configuring → Testing → Connected → Failed → Disabled.
- **DevOps Refresh:** Pending → Running → Completed / Completed-with-Warnings / Failed.
- **Invoice:** Draft → Generated → Approved → Sent → Partially Paid → Paid → Archived (and Cancelled).
- **Badge:** Not Earned → Earned → Displayed → Revoked.
- **Leaderboard:** Calculating → Published → Archived.
- **Notification:** Queued → Sent → Delivered → Read (Sent → Failed → Sent on retry).
- **AI Request:** Submitted → Processing → Completed / Failed / Cancelled.
- **Report Generation:** Requested → Generating → Completed / Failed → Published.
- **Exception / Compliance / Harvest Sync / Leave / Audit:** governed by FR-EXC, FR-VAL, FR-INT, FR-LEAVE, FR-AUD respectively.

**Master governance rule:** no transition occurs unless validation passes, the actor is permitted, an audit record is created, the prior state allows it, and the transition is recorded.

---

## 10. Data Model (high-level reference)

The PRD adopts the domain model from the requirements pack as the conceptual baseline for the Architecture phase. Core entities and relationships:

- **User Management:** User, Role, Permission, RolePermission.
- **Project Management:** Client, Project, ProjectConfiguration, Task, SubTask.
- **Resource Allocation:** ProjectAssignment, AllocationSnapshot.
- **Timesheet:** Timesheet, TimesheetEntry, TimerSession, TimeEntryRevision.
- **Azure DevOps:** DevOpsConfiguration, DevOpsTicket, DevOpsRefreshLog, DevOpsTicketMapping.
- **Calendar:** PublicHoliday, LeaveRequest.
- **Billing:** RateCard, Invoice, InvoiceLine, InvoiceEntryLink.
- **Reporting:** ReportSnapshot, KPIResult.
- **Gamification:** UserScore, PointsTransaction, Badge, UserBadge.
- **AI:** AIAgentProfile, AIInteraction.
- **Notification:** Notification, NotificationTemplate.
- **Audit:** AuditEvent.

**Core relationships:** Client → Projects; Project → Tasks/Users/DevOps Config/Rate Cards/Invoices/Timesheet Entries; User → Timesheets/Assignments/Scores/Badges/Notifications; Timesheet → Entries; Invoice → Invoice Lines; DevOps → Tickets. (Field-level detail in the requirements pack; finalised in Architecture.)

---

## 11. Open Questions

| ID | Question | Owner | Needed by |
|---|---|---|---|
| OQ1 | **Technology stack** — confirm .NET/React vs Node/React (Azure AD/DevOps integrations suggest .NET). | Architect / Sponsor | Architecture phase |
| OQ2 | **Harvest's role** — is Harvest an inbound source, an outbound sync target, or the system being replaced? The pack lists Harvest synchronisation; clarify direction and authority. | Sponsor | Before billing/integration epics |
| OQ3 | **Expense & receipt tracking** — Harvest has it; currently NG7. Confirm in-scope for v1 or deferred. | Sponsor | PRD sign-off |
| OQ4 | **AI model provider & cost ceiling** — which model(s); on-prem vs API; budget; data-residency constraints for client data. | Sponsor / Architect | Before AI epics |
| OQ5 | **Voice copilot** — in v1 (COULD) or deferred? Privacy implications of transcripts. | Sponsor | PRD sign-off |
| OQ6 | **Success-metric targets** (§3.2) — confirm specific numeric targets and SLAs (NFR-4). | Sponsor | PRD sign-off |
| OQ7 | **Strict allocation mode** default — block over-allocation entries by default, or warn? | Sponsor / PM | Before validation epics |
| OQ8 | **Multi-tenancy** — single org or SaaS multi-tenant? Affects data isolation and auth. | Sponsor / Architect | Architecture phase |
| OQ9 | **Federation scope** — is Keycloak and/or Azure AD required for v1, or local auth only initially? | Sponsor | Before IAM epics |
| OQ10 | **Native Harvest data import/migration** — is migrating existing Harvest data required? | Sponsor | Before delivery planning |
| OQ11 | **Currency/tax** — VAT rate(s), multi-currency invoicing requirements beyond ZAR. | Finance | Before invoicing epics |
| OQ12 | **Notification channels** — confirm Teams/Email/in-app priority for v1; SMS needed? | Sponsor | Before notification epics |
| OQ13 | **Product naming** — "INTRVL" appears in the pack; "betterharvest" is the repo. Confirm final product name. | Sponsor | PRD sign-off |

---

## 12. Sign-off Checklist

- [ ] **Purpose & vision** accepted (single source of truth; parity + enhancements framing).
- [ ] **Stakeholders & personas** confirmed (incl. UAT seed personas).
- [ ] **Goals & success metrics** (§3) — numeric targets confirmed (OQ6).
- [ ] **Non-goals** (§4) confirmed, incl. expense tracking decision (OQ3) and mobile/voice scope (OQ5).
- [ ] **Functional requirements** (§5) reviewed engine-by-engine; MoSCoW priorities agreed.
- [ ] **Cross-cutting governance rules** (§5.0) accepted (timesheet master, project-governed commercials, audited transitions).
- [ ] **Pre-seeded UAT environment** (§5.27) accepted as specified.
- [ ] **Non-functional requirements** (§6) accepted; SLAs confirmed (NFR-4).
- [ ] **Acceptance criteria** (§7) accepted as the sign-off test basis.
- [ ] **State machines** (§9) accepted as authoritative.
- [ ] **Data model baseline** (§10) accepted for Architecture phase.
- [ ] **Risks** (§8) reviewed; mitigations owned.
- [ ] **Open questions** (§11) assigned owners and due dates; blockers resolved before dependent epics.
- [ ] **Stack & multi-tenancy** direction noted for Architecture phase (OQ1, OQ8).
- [ ] **Product name** confirmed (OQ13).
- [ ] PRD approved by: Product Owner / Sponsor ▢  Delivery Manager ▢  Lead Architect ▢  Finance ▢

---

## Appendix A — Master Validation Rules

Authoritative validation matrix (preserved from the requirements pack). Block = prevents save/submit; No Block = warning/penalty/info.

| # | Condition | Rule | Type | Message | Block? |
|---|---|---|---|---|---|
| 1 | Hours entered | > 0 and ≤ 24 | Data Integrity | Invalid hours entered | BLOCK |
| 2 | Overlapping entries | None per user/day | Data Integrity | Time entries overlap | BLOCK |
| 3 | Missing project | Project required | Required Field | Project must be selected | BLOCK |
| 4 | Missing task (if required) | Task required when project enforces tasks | Required Field | Task is required for this project | BLOCK |
| 5 | Missing description | Description mandatory | Content | Description cannot be empty | BLOCK |
| 6 | Description too short | Minimum length | Content Quality | Description too short | BLOCK |
| 7 | No hours on working day | Daily entry required | Completeness | No time logged for working day | NO BLOCK (warning) |
| 8 | Weekly hours below allocation | Must meet allocation target | Allocation | Below expected weekly hours | NO BLOCK (warning) |
| 9 | Weekly hours exceed allocation | Cannot exceed without approval | Allocation | Allocation exceeded | BLOCK (if strict mode) |
| 10 | Project not ACTIVE | Only ACTIVE accept time | Project State | Project not active | BLOCK |
| 11 | Project in DRAFT | No logging | Lifecycle | Project not active | BLOCK |
| 12 | Allocation exceeds 100% | Total ≤ 100% | Allocation | Allocation exceeds limit | BLOCK |
| 13 | Unassigned user logs time | Must be assigned | Permission | User not assigned to project | BLOCK |
| 14 | Overtime on OT-disabled project | OT must be allowed | Business | Overtime not allowed for this project | BLOCK |
| 15 | Overtime exceeds threshold | OT limit enforced | Compliance | Overtime limit exceeded | BLOCK |
| 16 | Overtime needs approval | Requires PM approval | Workflow | Overtime requires approval | NO BLOCK (pending) |
| 17 | DevOps PAT invalid | Must pass handshake | Integration | DevOps connection failed | BLOCK |
| 18 | DevOps ticket inactive | Only ACTIVE | Integration | Ticket not active | NO BLOCK (ignored) |
| 19 | DevOps ticket unmapped | Must map to project/task | Mapping | Ticket not mapped | NO BLOCK (warning) |
| 20 | Submission missing data | All required complete | Submission Gate | Cannot submit incomplete timesheet | BLOCK |
| 21 | Submission after deadline | Before cutoff | Scheduling | Submission is late | NO BLOCK (penalty) |
| 22 | Auto-approval conditions met | Hours + descriptions + allocation | Workflow | Auto-approved | NO BLOCK |
| 23 | Auto-approval conditions NOT met | Require PM review | Workflow | Requires PM approval | NO BLOCK |
| 24 | Reporting includes draft data | Only approved | Reporting | Draft data excluded | NO BLOCK |
| 25 | Reporting data outdated | Sync latest approved | Sync | Refresh required | NO BLOCK |
| 26 | Gamification before approval | Points only after approval | Reward | Not eligible for points | NO BLOCK |
| 27 | Overtime points on disabled project | No OT points if not allowed | Reward | No overtime rewards | NO BLOCK |
| 28 | AI generates work on holiday | AI respects holiday calendar | AI | Cannot generate holiday work | BLOCK |
| 29 | AI exceeds allocation | AI cannot exceed allocation | AI | Allocation exceeded | BLOCK |
| 30 | Locked timesheet edited | Locked entries immutable | Audit | Entry is locked | BLOCK |
| 31 | Audit log missing | All actions logged | Compliance | Audit failure | BLOCK |
| 32 | Submission with no project assignment | Must belong to project | System | No project assigned | BLOCK |
| 33 | Duplicate time entry | Prevent duplicates | Data Integrity | Duplicate entry detected | BLOCK |
| 34 | Public holiday entry mismatch | Holidays auto-adjust expected hours | Calendar | Holiday detected | NO BLOCK |
| 35 | Utilisation calc invalid | Exclude holidays/leave | Analytics | Invalid utilisation calculation | NO BLOCK (warning) |

---

## Appendix B — Utilisation, Productivity & Capacity Formulas

Preserved from the requirements pack; authoritative for the Reporting engine (FR-REP-5).

- **Monthly workable hours** = (Working Days × Standard Daily Hours) − Public Holidays − Approved Leave.
  - *Example:* 22 working days × 8h = 176h; less 1 holiday (8h) = **168h** workable capacity.
- **Billable utilisation** = Billable Hours ÷ Workable Capacity × 100.
  - *Example:* 140 ÷ 168 × 100 = **83.3%**.
- **Productivity** = Billable Hours ÷ Total Logged Hours × 100.
  - *Example:* 140 ÷ 160 × 100 = **87.5%**.
- **Capacity utilisation** = Total Logged Hours ÷ Workable Capacity × 100.
  - *Example:* 160 ÷ 168 × 100 = **95.2%**.
- **Allocation achievement** = Actual Allocation vs Expected Allocation (variance-based; 100%→full points band, etc.).

**Utilisation health bands:** ≥ 95% 🟢 Exceptional · 85–94% 🟢 Healthy · 75–84% 🟠 Watch · 60–74% 🟠 Under-utilised · < 60% 🔴 Action required.

**Views to expose:** Person view (workable/billable/non-billable/leave hours, utilisation, productivity, capacity usage, allocation achievement, compliance, rank, level); Project view (budget/consumed/remaining hours, billable %, revenue, internal cost, margin, profitability); Project Team tab (per-member billable/non-billable/utilisation); Utilisation leaderboard (separate from points); Executive dashboard (budget consumption, billable ratio, average utilisation/productivity, revenue, remaining budget, forecast completion, top performer, most improved, highest compliance).

---

## Appendix C — Requirements Traceability (engines → requirements)

| Engine | Requirement IDs | Acceptance IDs |
|---|---|---|
| Identity & Access | FR-IAM-1..12 | AC-IAM-1..6 |
| Global Configuration | FR-CFG-1..5 | AC-TS-2 (holidays), AC-SEED-1 |
| Workforce Management | FR-WF-1..6 | AC-IAM-6, AC-ALLOC-* |
| Client Management | FR-CLI-1..5 | AC-PRJ-5, AC-INV-1 |
| Project Portfolio | FR-PRJ-1..17 | AC-PRJ-1..5 |
| Resource Allocation | FR-ALLOC-1..6 | AC-ALLOC-1..3, AC-VAL-2 |
| Leave & Absence | FR-LEAVE-1..4 | AC-TS-3 |
| Timesheet Capture | FR-TS-1..9 | AC-TS-1..5 |
| Timer Tracking | FR-TIMER-1..3 | AC-TIMER-1..2 |
| Compliance & Validation | FR-VAL-1..9 | AC-VAL-1..4 (Appendix A) |
| Approval Workflow | FR-APR-1..6 | AC-APR-1..4 |
| Azure DevOps | FR-ADO-1..10 | AC-ADO-1..5 |
| AI Copilot | FR-AI-1..12 | AC-AI-1..5 |
| Notification & Reminder | FR-NOT-1..6 | AC-APR-3 |
| Auto Submission | FR-AUTO-1..4 | AC-APR-3 |
| Billing & Revenue | FR-BILL-1..4 | AC-BILL-1 |
| Rate Management | FR-RATE-1..3 | AC-PRJ-5 |
| Invoice & Receivables | FR-INV-1..13 | AC-INV-1..3 |
| Reporting & Analytics | FR-REP-1..8 | AC-REP-1..3 |
| Visualization | FR-VIZ-1..2 | AC-REP-* |
| Gamification | FR-GAM-1..6 | AC-GAM-1..3 |
| External Integration | FR-INT-1..4 | (Harvest sync) |
| Audit & Governance | FR-AUD-1..4 | AC-AUD-1 |
| Administration & Ops | FR-ADM-1..4 | — |
| Export & Distribution | FR-EXP-1..3 | AC-INV-2 |
| Exception Management | FR-EXC-1..2 | AC-VAL-3 |
| UAT Seed | FR-SEED-1..9 | AC-SEED-1 |
| Cross-cutting Governance | FR-GOV-1..5 | AC-SYS-1, AC-AUD-1, AC-REP-1 |

---

*End of PRD v1.0 — ready for sign-off review. On approval, proceed to the Architecture phase (resolve OQ1, OQ8) and then Epics & Stories (MoSCoW-prioritised, MUST-first).*
