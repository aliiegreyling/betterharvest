---
title: BetterHarvest API Specification
status: draft
created: 2026-05-21
updated: 2026-05-21
source_prd: prd-2026-05-21/prd.md
---

# BetterHarvest API Specification

## 1. API Style

Use REST-style JSON endpoints under `/api/v1`. Route handlers call application use cases. All tenant routes require selected organization context via session claims or `x-organization-id`. Responses use consistent envelope shape for errors.

Common rules:

- Authenticated requests require session/JWT.
- Mutations require CSRF protection when cookie-based.
- Validation uses DTO schemas.
- All list endpoints support pagination.
- Tenant scope is mandatory.

## 2. Common DTOs

```ts
type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  traceId: string;
};

type Page<T> = {
  items: T[];
  nextCursor?: string;
  total?: number;
};
```

## 3. Endpoint Catalog

| Method | Route | Purpose | Request DTO | Response DTO | Auth | Validation |
|---|---|---|---|---|---|---|
| POST | `/auth/sign-in` | Start session | `SignInRequest` | `SessionDto` | Public | email valid |
| POST | `/auth/sign-out` | End session | none | `204` | User | active session |
| GET | `/session` | Current session | none | `SessionDto` | User | none |
| GET | `/organizations` | List memberships | none | `OrganizationSummary[]` | User | none |
| POST | `/organizations` | Create organization | `CreateOrganizationRequest` | `OrganizationDto` | User | name, timezone, currency |
| GET | `/organizations/current` | Current org settings | none | `OrganizationDto` | Member | selected org |
| PATCH | `/organizations/current` | Update org settings | `UpdateOrganizationRequest` | `OrganizationDto` | Admin | valid settings |
| GET | `/users` | List org users | filters | `Page<UserDto>` | Admin/Manager | scope |
| POST | `/users/invitations` | Invite user | `InviteUserRequest` | `InvitationDto` | Admin | email, role |
| PATCH | `/users/{userId}/role` | Change role | `ChangeRoleRequest` | `UserDto` | Admin | role exists |
| GET | `/clients` | List clients | filters | `Page<ClientDto>` | Member | permission |
| POST | `/clients` | Create client | `CreateClientRequest` | `ClientDto` | Manager/Admin | name unique |
| GET | `/clients/{clientId}` | Get client | none | `ClientDto` | Member | visible |
| PATCH | `/clients/{clientId}` | Update client | `UpdateClientRequest` | `ClientDto` | Manager/Admin | valid fields |
| DELETE | `/clients/{clientId}` | Archive client | none | `204` | Manager/Admin | no active constraints or archive allowed |
| GET | `/projects` | List projects | filters | `Page<ProjectDto>` | Member | visible |
| POST | `/projects` | Create project | `CreateProjectRequest` | `ProjectDto` | Manager/Admin | client/task/rate refs |
| GET | `/projects/{projectId}` | Project detail | none | `ProjectDetailDto` | Project member/Manager | visible |
| PATCH | `/projects/{projectId}` | Update project | `UpdateProjectRequest` | `ProjectDto` | Manager/Admin | valid budget/rates |
| POST | `/projects/{projectId}/members` | Add member | `AddProjectMemberRequest` | `ProjectMemberDto` | Manager/Admin | user exists |
| GET | `/tasks` | List tasks | filters | `TaskDto[]` | Member | none |
| POST | `/tasks` | Create task | `CreateTaskRequest` | `TaskDto` | Manager/Admin | name unique |
| PATCH | `/tasks/{taskId}` | Update task | `UpdateTaskRequest` | `TaskDto` | Manager/Admin | valid |
| GET | `/time-entries` | List entries | date/user/project filters | `Page<TimeEntryDto>` | Own/Manager | date range |
| POST | `/time-entries` | Create manual entry | `CreateTimeEntryRequest` | `TimeEntryDto` | Member | project/task/date/duration |
| PATCH | `/time-entries/{entryId}` | Update entry | `UpdateTimeEntryRequest` | `TimeEntryDto` | Owner/Manager | not locked |
| DELETE | `/time-entries/{entryId}` | Soft delete entry | reason | `204` | Owner/Manager | not locked or correction permission |
| POST | `/timer/start` | Start timer | `StartTimerRequest` | `TimerDto` | Member | project/task optional policy |
| POST | `/timer/stop` | Stop timer | `StopTimerRequest` | `TimeEntryDto` | Member | active timer |
| GET | `/timesheets/current` | Current timesheet | period | `TimesheetDto` | Member | period valid |
| GET | `/timesheets` | List timesheets | filters | `Page<TimesheetDto>` | Own/Manager | scope |
| POST | `/timesheets/{timesheetId}/submit` | Submit timesheet | `SubmitTimesheetRequest` | `TimesheetDto` | Owner | validation passes |
| POST | `/timesheets/{timesheetId}/approve` | Approve | `ApprovalRequest` | `TimesheetDto` | Manager | approver scope |
| POST | `/timesheets/{timesheetId}/return` | Return for changes | `ReturnRequest` | `TimesheetDto` | Manager | comment required |
| GET | `/approvals` | Approval queue | filters | `Page<ApprovalQueueItemDto>` | Manager | team scope |
| GET | `/reports/time` | Time report | filters/grouping | `TimeReportDto` | Member/Manager | report permission |
| GET | `/reports/profitability` | Profitability report | filters | `ProfitabilityReportDto` | Finance/Manager | financial permission |
| POST | `/reports/saved` | Save report | `SaveReportRequest` | `SavedReportDto` | Member | valid filters |
| GET | `/budgets` | List budgets | filters | `Page<BudgetDto>` | Manager/Finance | permission |
| POST | `/budgets` | Create budget | `CreateBudgetRequest` | `BudgetDto` | Manager/Finance | amount/type |
| GET | `/invoices` | List invoices | filters | `Page<InvoiceDto>` | Finance | permission |
| POST | `/invoices/draft` | Draft invoice | `DraftInvoiceRequest` | `InvoiceDto` | Finance | approved sources |
| PATCH | `/invoices/{invoiceId}` | Update invoice | `UpdateInvoiceRequest` | `InvoiceDto` | Finance | status rules |
| POST | `/invoices/{invoiceId}/send` | Send/export invoice | `SendInvoiceRequest` | `InvoiceDto` | Finance | valid recipient |
| GET | `/expenses` | List expenses | filters | `Page<ExpenseDto>` | Own/Manager/Finance | scope |
| POST | `/expenses` | Create expense | `CreateExpenseRequest` | `ExpenseDto` | Member | amount/project/category |
| PATCH | `/expenses/{expenseId}` | Update expense | `UpdateExpenseRequest` | `ExpenseDto` | Owner/Manager | not locked |
| GET | `/integrations` | List integrations | none | `IntegrationDto[]` | Admin/User | scope |
| POST | `/integrations/{provider}/connect` | Start OAuth | `ConnectIntegrationRequest` | `ConnectUrlDto` | User/Admin | provider enabled |
| POST | `/integrations/{provider}/sync` | Queue sync | none | `JobDto` | User/Admin | connected |
| GET | `/ai/suggestions` | List suggestions | filters | `Page<AiSuggestionDto>` | Owner/Manager | scope |
| POST | `/ai/suggestions/{id}/accept` | Accept suggestion | `AcceptSuggestionRequest` | source DTO | Owner | editable source |
| POST | `/ai/suggestions/{id}/dismiss` | Dismiss suggestion | reason | `AiSuggestionDto` | Owner | active suggestion |
| POST | `/ai/assistant/query` | Ask report/project question | `AssistantQueryRequest` | `AssistantAnswerDto` | Permission-scoped | safe query |

## 4. Authorization Rules

- Own time entries: user can manage while period is unlocked.
- Manager time visibility: limited to assigned teams/projects unless admin.
- Financial reports: require `report.view.financial`.
- Rates: cost rates hidden unless `rate.view_cost`.
- AI assistant inherits the strictest permission of the data it queries.
- Client viewers only access explicitly shared reports/invoices.

## 5. Validation Rules

- Time duration must be positive and within organization maximum.
- Start/end entries cannot overlap for same user unless policy allows.
- Submitted timesheets cannot be modified except through correction workflow.
- Invoice drafts can only include approved billable records not already invoiced.
- Budget thresholds must be between 1 and 100 percent.
- Integration tokens are never returned to clients.
