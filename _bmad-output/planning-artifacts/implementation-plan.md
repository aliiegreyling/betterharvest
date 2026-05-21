---
title: BetterHarvest Implementation Plan
status: draft
created: 2026-05-21
updated: 2026-05-21
source_prd: prd-2026-05-21/prd.md
---

# BetterHarvest Implementation Plan

## 1. Milestones

### Milestone 0: Repository Foundation

Objective: Scaffold production-ready Next.js application with clean architecture folders, database, auth shell, design system, testing, linting, Docker, and CI.

Deliverables:

- Next.js App Router TypeScript project.
- Postgres ORM setup.
- Clean architecture feature folders.
- App shell and theme foundation.
- CI with lint/typecheck/test/build.
- Docker Compose for app and Postgres.

### Milestone 1: Auth And Organization Setup

Deliver auth, session, organization creation, organization switcher, roles, memberships, and permission checks.

### Milestone 2: Client, Project, Task Core

Deliver CRUD for clients, projects, tasks, project members, and baseline search/filter UI.

### Milestone 3: Time Tracking MVP

Deliver manual entries, active timer, favorites/recents, weekly grid, validation, and personal dashboard.

### Milestone 4: Timesheets And Approvals

Deliver timesheet period generation, submission, manager approval queue, return comments, locking, audit events, and notifications placeholder.

### Milestone 5: Basic Reports And Dashboard

Deliver time reports, dashboard widgets, CSV export, saved filters, and manager status views.

### Milestone 6: V1 Finance Layer

Deliver budgets, rates, expenses, invoices, invoice draft generation, exports, audit refinements, and team dashboards.

### Milestone 7: V2 Intelligence And Planning

Deliver AI suggestions, calendar/work-system integrations, capacity planning, profitability insights, and natural-language reports.

## 2. First Sprint Backlog

### Story 1: Scaffold Next.js Workspace

As a developer, I can run the app locally with a Postgres database so implementation can begin consistently.

Acceptance:

- `npm run dev` starts the app.
- `npm run lint`, `npm run typecheck`, and `npm test` exist.
- Docker Compose starts Postgres.
- Environment variables documented.
- Initial folder structure matches architecture document.

### Story 2: Database And ORM Foundation

As a developer, I can define and migrate core auth/organization tables.

Acceptance:

- Initial schema includes users, organizations, memberships, roles, permissions.
- Migrations run locally.
- Seed script creates demo organization and roles.
- Tenant-scoped repository pattern exists.

### Story 3: App Shell And Design System Base

As a user, I can open a signed-in app shell with navigation, theme toggle, and global timer placeholder.

Acceptance:

- Responsive app shell.
- Light/dark mode.
- Navigation routes stubbed.
- UI primitives installed.
- Accessibility smoke checks pass.

### Story 4: Auth Session Placeholder

As a user, I can sign in through the selected auth approach and see my organization context.

Acceptance:

- Session available server-side.
- Protected routes redirect unauthenticated users.
- Organization context selected.
- Basic audit event logged for sign-in.

### Story 5: Client/Project/Task Vertical Slice

As a manager, I can create a client, project, and task so time entries have valid dimensions.

Acceptance:

- Create/list pages for clients/projects/tasks.
- Server-side validation.
- Tenant isolation tests.
- Empty/loading/error states.

## 3. Coding-Agent Task Breakdown

### Backend Agent

Objective: Build application/domain/data use cases for auth, organizations, clients, projects, tasks, time entries, and timesheets.

Files/modules:

- `src/features/*/application`
- `src/features/*/domain`
- `src/features/*/data`
- `src/server/db`
- `src/server/permissions`

Acceptance:

- Use cases enforce tenant scope.
- DTO validation is covered.
- Unit and integration tests exist.
- No React imports in application/domain layers.

Edge cases:

- Archived clients/projects.
- Locked timesheets.
- Cross-tenant IDs.
- Invalid role changes.

Security:

- Permission checks before every mutation.
- Audit events for sensitive actions.

### Frontend Agent

Objective: Build app shell, route pages, reusable UI, weekly grid, timer controls, dashboards, and forms.

Files/modules:

- `src/app/(app)`
- `src/components`
- `src/features/*/presentation`

Acceptance:

- Responsive and accessible.
- Loading/empty/error states.
- Keyboard support for weekly grid.
- Client components are used only where interaction requires them.

Edge cases:

- Long project/client names.
- Mobile weekly grid.
- Timer conflict state.

Security:

- Do not expose hidden financial fields to unauthorized users.

### Database Agent

Objective: Implement Postgres schema, migrations, seed data, indexes, and repository helpers.

Files/modules:

- `prisma/schema.prisma` or `drizzle/schema.ts`
- `prisma/migrations` or equivalent
- `src/server/db`

Acceptance:

- Core tables and constraints implemented.
- Indexes match architecture guidance.
- Soft delete fields included.
- Seed data supports demo workflows.

Edge cases:

- Unique constraints with soft delete.
- Timezone/date boundaries.
- Timesheet period uniqueness.

Security:

- Avoid unscoped query helpers.

### UX Agent

Objective: Turn UX spec into route-by-route wireframe decisions and component behavior.

Files/modules:

- `docs/ux`
- `src/components`
- `src/features/*/presentation`

Acceptance:

- App shell and core workflows match UX spec.
- Design tokens documented.
- Accessibility rules applied.

Edge cases:

- Dense reports on mobile.
- Empty organizations.
- Approval queues with many warnings.

### QA Agent

Objective: Create unit, integration, and E2E coverage for MVP flows.

Files/modules:

- `tests/unit`
- `tests/integration`
- `tests/e2e`

Acceptance:

- Auth/tenant test utilities.
- E2E for create project, log time, submit, approve.
- CI runs tests.

Edge cases:

- Cross-tenant access attempts.
- Locked timesheet edits.
- Overlapping entries.

### DevOps Agent

Objective: Provide local, CI, and Azure-ready deployment path.

Files/modules:

- `docker-compose.yml`
- `Dockerfile`
- `.github/workflows`
- `infra/`

Acceptance:

- Reproducible local stack.
- CI validates pull requests.
- Container image builds.
- Secrets documented.

Security:

- No secrets committed.
- Dependency scan/image scan included.

### Documentation Agent

Objective: Maintain developer onboarding and product docs.

Files/modules:

- `README.md`
- `docs/`
- `_bmad-output/`

Acceptance:

- Local setup instructions.
- Architecture decision notes.
- API docs linked.
- Sprint docs indexed.

## 4. Test Strategy

### Unit Tests

- Domain value objects and policies.
- Permission checks.
- Timesheet validation.
- Rate precedence.
- Budget calculations.

### Integration Tests

- Repository tenant isolation.
- API route handlers.
- Database constraints.
- Auth/session organization context.
- Audit logging.

### E2E Tests

- Sign in and organization setup.
- Create client/project/task.
- Start/stop timer.
- Edit weekly timesheet.
- Submit timesheet.
- Approve/return timesheet.
- Run basic report.

### Non-Functional Tests

- Accessibility smoke tests.
- Performance checks for dashboard/report queries.
- Security regression tests for IDOR/cross-tenant access.
- Backup/restore rehearsal before production.

## 5. Security Checklist

- Tenant scope required on all application use cases.
- IDOR tests for every entity route.
- Central permission service with explicit policies.
- Session expiration and refresh policy.
- CSRF protection for cookie-auth mutations.
- Input validation on every boundary.
- Audit log for auth, roles, time locks, approvals, invoices, exports, integration changes.
- Secrets stored outside repo.
- Integration tokens encrypted or provider-managed.
- AI prompts permission-scoped and logged with metadata.
- Rate limiting on auth, exports, AI, and reporting endpoints.
- File upload restrictions for receipts.
- Dependency and container scanning in CI.
- Security headers configured.

## 6. Definition Of Ready

A story is ready when it has:

- PRD FR reference.
- UX surface or API contract.
- Acceptance criteria.
- Validation rules.
- Permission expectations.
- Test expectations.
- Known edge cases.

## 7. Definition Of Done

A story is done when:

- Implementation matches acceptance criteria.
- Unit/integration/E2E tests pass as appropriate.
- Accessibility and responsive states are checked.
- Tenant and permission checks are covered.
- Audit logging added where required.
- Documentation updated.
- No high-severity review findings remain.
