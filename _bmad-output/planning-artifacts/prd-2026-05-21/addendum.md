# BetterHarvest PRD Addendum

## Source Prompt Summary

The product is a modern Harvest-style web app for time tracking, timesheets, project profitability, invoicing, client budgets, capacity planning, and AI-assisted operational insight. It should serve software teams, agencies, consultants, and client-service businesses. It must be simple, fast, auditable, production-ready, and should use AI only where it reduces admin or improves accuracy.

## Research Baseline

Official product pages reviewed on 2026-05-21:

- Harvest: time tracking, expenses, reporting, invoicing, payments, budgets, team management, project/client organization, planning, integrations.
- Toggl Track: calendar view with Google/Outlook, offline tracking, mobile/desktop apps, one-click timers, shared entries, favorites, timeline activity capture, flexible reporting, profitability by project/client/member/team, invoicing.
- Clockify: timer, timesheet, kiosk, planning, budget/estimate tracking, team capacity, attendance, billable hours, payroll-oriented reporting.
- Timely: automatic background tracking, Memory tracker, AI-powered timesheet creation, operational insights.

Product implication: BetterHarvest should compete on low-friction capture, trustable approval/audit flows, project finance clarity, and smart suggestions that remain explainable.

## Technical Direction Notes

The seed prompt mentioned a .NET 10 clean architecture stack. The direct project request says to scaffold with a full Next.js framework. Current direction is Next.js full-stack with explicit clean architecture boundaries:

- Presentation: app routes, pages, layouts, server/client components, design system components.
- Application: use cases, commands, queries, policies, DTOs, validators.
- Domain: entities, value objects, domain services, events, permission rules.
- Data/Infrastructure: database repositories, Prisma/Drizzle schema, integrations, job workers, email, storage, AI providers.

If the team later chooses .NET 10 for the backend, the PRD remains valid; the architecture document marks where the backend boundary can split from Next.js.
