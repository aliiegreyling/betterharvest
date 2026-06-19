const weekDays = [
  { key: "mon", label: "Mon", date: "15 Jun" },
  { key: "tue", label: "Tue", date: "16 Jun", holiday: "Youth Day" },
  { key: "wed", label: "Wed", date: "17 Jun" },
  { key: "thu", label: "Thu", date: "18 Jun" },
  { key: "fri", label: "Fri", date: "19 Jun" },
  { key: "sat", label: "Sat", date: "20 Jun", weekend: true },
  { key: "sun", label: "Sun", date: "21 Jun", weekend: true }
];

const navItems = [
  ["dashboard", "DB", "Dashboard"],
  ["timesheets", "TS", "Timesheets"],
  ["approvals", "AP", "Approvals"],
  ["projects", "PR", "Projects"],
  ["capacity", "CA", "Capacity"],
  ["devops", "DO", "Azure DevOps"],
  ["reports", "RP", "Reports"],
  ["invoicing", "IN", "Invoicing"],
  ["engage", "EG", "Engage"],
  ["admin", "AD", "Admin"]
];

const roleAccess = {
  Consultant: ["dashboard", "timesheets", "devops", "reports", "engage"],
  PM: [
    "dashboard",
    "timesheets",
    "approvals",
    "projects",
    "capacity",
    "devops",
    "reports",
    "invoicing",
    "engage"
  ],
  Finance: ["dashboard", "reports", "invoicing"],
  Executive: ["dashboard", "approvals", "projects", "capacity", "reports", "engage"],
  Admin: navItems.map((item) => item[0])
};

const initialEntries = [
  {
    id: "eskom-dev",
    project: "Eskom Modernisation Programme",
    task: "Sprint delivery",
    workType: "Development",
    allocation: 32,
    billable: "Billable from project config",
    rate: "ZAR 1,250/hr",
    overtimeAllowed: false,
    description:
      "Implemented secure timesheet validation and reviewed allocation compliance outcomes.",
    hours: { mon: 0, tue: 0, wed: 8, thu: 8, fri: 6, sat: 0, sun: 0 }
  },
  {
    id: "eskom-ba",
    project: "Eskom Modernisation Programme",
    task: "Requirements refinement",
    workType: "Business Analysis",
    allocation: 0,
    billable: "Billable from project config",
    rate: "ZAR 1,150/hr",
    overtimeAllowed: false,
    description:
      "Refined acceptance criteria and aligned stakeholder feedback to active delivery tickets.",
    hours: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
  },
  {
    id: "internal-admin",
    project: "Internal Operations",
    task: "Practice administration",
    workType: "Internal Administration",
    allocation: 0,
    billable: "Non-billable from project config",
    rate: "Not billable",
    overtimeAllowed: false,
    description: "",
    hours: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
  }
];

const devopsTickets = [
  {
    id: "ADO-1842",
    title: "Timesheet validation matrix",
    status: "Active",
    workType: "Development",
    estimate: 5,
    mapped: true
  },
  {
    id: "ADO-1857",
    title: "Approval-by-exception review panel",
    status: "In Progress",
    workType: "Business Analysis",
    estimate: 3,
    mapped: true
  },
  {
    id: "ADO-1899",
    title: "Invoice annexure evidence pack",
    status: "New",
    workType: "Documentation",
    estimate: 2,
    mapped: false
  }
];

const state = {
  route: "dashboard",
  role: "PM",
  week: "2026-W25",
  locked: false,
  timesheetStatus: "Validation Warning",
  entries: structuredClone(initialEntries),
  activeTimer: null,
  exceptionQueue: [
    {
      id: "ts-justice-2026-w25",
      person: "Justice J",
      week: "2026-W25",
      reason: "Missing Friday hours and one description below quality threshold",
      hours: 28,
      target: 32,
      status: "Awaiting PM approval"
    },
    {
      id: "ts-alex-2026-w24",
      person: "Alex G",
      week: "2026-W24",
      reason: "Overtime logged on project with overtime disabled",
      hours: 43,
      target: 40,
      status: "Returned"
    }
  ],
  audit: [
    "2026-06-19 08:16 - Connor C opened PM dashboard",
    "2026-06-19 08:22 - DevOps refresh completed with 1 unmapped ticket",
    "2026-06-19 09:05 - Auto-approval locked Justice J week 2026-W24"
  ],
  messages: [
    {
      who: "ai",
      text:
        "I can fill missing working-day hours, improve descriptions, explain validation failures, or preview active Azure DevOps tickets. Suggestions stay draft until accepted."
    }
  ],
  toasts: []
};

const app = document.querySelector("#app");

function render() {
  const visibleNav = navItems.filter(([route]) => roleAccess[state.role].includes(route));
  if (!roleAccess[state.role].includes(state.route)) state.route = "dashboard";

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">I</div>
          <div>
            <div class="brand-name">INTRVL</div>
            <div class="brand-subtitle">Time and resource platform</div>
          </div>
        </div>
        <div class="nav-group-label">Workspace</div>
        ${visibleNav
          .map(
            ([route, icon, label]) => `
              <button class="nav-button ${state.route === route ? "active" : ""}" data-route="${route}">
                <span class="nav-icon">${icon}</span>
                <span>${label}</span>
              </button>
            `
          )
          .join("")}
      </aside>
      <main class="main">
        ${renderTopbar()}
        ${renderRoute()}
      </main>
      ${renderCopilot()}
      <div class="toast-region" aria-live="polite">
        ${state.toasts.map((toast) => `<div class="toast ${toast.kind}">${toast.text}</div>`).join("")}
      </div>
    </div>
  `;

  bindEvents();
}

function renderTopbar() {
  return `
    <div class="topbar">
      <input class="search" type="search" placeholder="Search projects, tickets, people, invoices" aria-label="Global search" />
      <select class="week-picker" aria-label="Selected week">
        <option selected>Week of 15 Jun 2026</option>
        <option>Week of 22 Jun 2026</option>
      </select>
      <select class="role-switcher" aria-label="Role context">
        ${Object.keys(roleAccess)
          .map((role) => `<option ${state.role === role ? "selected" : ""}>${role}</option>`)
          .join("")}
      </select>
    </div>
  `;
}

function renderHeader(eyebrow, title, copy, actions = "") {
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="muted">${copy}</p>
      </div>
      <div class="actions">${actions}</div>
    </header>
  `;
}

function renderRoute() {
  const views = {
    dashboard: renderDashboard,
    timesheets: renderTimesheets,
    approvals: renderApprovals,
    projects: renderProjects,
    capacity: renderCapacity,
    devops: renderDevOps,
    reports: renderReports,
    invoicing: renderInvoicing,
    engage: renderEngage,
    admin: renderAdmin
  };
  return views[state.route]();
}

function renderDashboard() {
  const totals = calculateTotals();
  return `
    ${renderHeader(
      "Role-aware home",
      `${state.role} dashboard`,
      "Harvest-style time capture with allocation compliance, approval-by-exception, DevOps sync, AI assistance, billing evidence, and audit visibility.",
      `<button class="button primary" data-route="timesheets">Open timesheet</button>`
    )}
    <section class="grid four">
      ${metric("Weekly hours", `${formatHours(totals.weekTotal)}h`, `${formatHours(totals.expected)}h expected after holiday`, totals.weekTotal >= totals.expected ? "ok" : "warn")}
      ${metric("Auto-approval rate", "87%", "Target is at least 85%", "ok")}
      ${metric("Exceptions", `${state.exceptionQueue.length}`, "Only non-compliant submissions reach PMs", state.exceptionQueue.length ? "warn" : "ok")}
      ${metric("Uninvoiced approved", "ZAR 84k", "Snapshot-ready approved entries", "info")}
    </section>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <div class="split-row">
          <h2>My week</h2>
          ${statusChip(state.timesheetStatus)}
        </div>
        ${targetMeter(totals.weekTotal, totals.expected)}
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>Project</th><th class="numeric">Actual</th><th class="numeric">Target</th><th>Status</th></tr></thead>
            <tbody>
              ${state.entries
                .map((entry) => {
                  const total = entryTotal(entry);
                  return `<tr>
                    <td><strong>${entry.project}</strong><br><span class="muted">${entry.task}</span></td>
                    <td class="numeric">${formatHours(total)}h</td>
                    <td class="numeric">${formatHours(entry.allocation)}h</td>
                    <td>${statusChip(projectStatus(entry, total))}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel pad">
        <h2>Portfolio health</h2>
        <div class="chart" aria-label="Portfolio utilisation chart">
          ${[
            ["Util", 88],
            ["Alloc", 94],
            ["Bill", 81],
            ["Margin", 36],
            ["Comp", 91],
            ["Sync", 73]
          ]
            .map(([label, value]) => `<div class="bar"><span style="height:${value}%"></span><label>${label}</label></div>`)
            .join("")}
        </div>
      </div>
    </section>
    <section class="grid three" style="margin-top:14px">
      ${workflowCard("Time capture", "Grid, timer, duplicate week, holiday/leave handling, real-time validation.", "Open", "timesheets")}
      ${workflowCard("Approval queue", "Compliant sheets auto-approve; PMs handle only exceptions.", "Review", "approvals")}
      ${workflowCard("Commercial governance", "Billable, rates, overtime and budget behaviour are inherited from project configuration.", "Configure", "projects")}
    </section>
  `;
}

function renderTimesheets() {
  const totals = calculateTotals();
  const validation = validateTimesheet();
  const actions = `
    <button class="button" data-action="timer">${state.activeTimer ? "Stop timer" : "Start timer"}</button>
    <button class="button" data-action="ai-fill">AI fill missing</button>
    <button class="button" data-route="devops">DevOps preview</button>
    <button class="button primary" data-action="submit" ${state.locked ? "disabled" : ""}>Submit week</button>
  `;

  return `
    ${renderHeader(
      "Timesheet master record",
      "Week of 15 Jun 2026",
      "Capture decimal hours against active assigned projects. Commercial fields are resolved from project configuration and remain read-only.",
      actions
    )}
    <div class="banner">
      <div>
        <strong>Public holiday detected: Youth Day on Tue 16 Jun.</strong>
        Expected hours are reduced from 40h to ${formatHours(totals.expected)}h. AI auto-fill and missing-hour warnings are suppressed for that day.
      </div>
      ${statusChip(state.locked ? "Locked" : state.timesheetStatus)}
    </div>
    <section class="grid three">
      ${metric("Logged", `${formatHours(totals.weekTotal)}h`, `${formatHours(Math.max(totals.expected - totals.weekTotal, 0))}h remaining`, totals.weekTotal >= totals.expected ? "ok" : "warn")}
      ${metric("Eskom allocation", `${formatHours(totals.eskomTotal)}h`, "32h target for current user", totals.eskomTotal >= 32 ? "ok" : "warn")}
      ${metric("Validation", validation.blocks ? `${validation.blocks} blocks` : `${validation.warnings} warnings`, "Server remains authoritative in production", validation.blocks ? "error" : validation.warnings ? "warn" : "ok")}
    </section>
    <div class="panel pad" style="margin-top:14px">
      <div class="split-row">
        <h2>Weekly grid</h2>
        ${targetMeter(totals.weekTotal, totals.expected)}
      </div>
      <div class="table-wrap">
        <table class="timesheet-table">
          <thead>
            <tr>
              <th>Assignment</th>
              ${weekDays
                .map((day) => `<th class="numeric">${day.label}<br><span class="muted">${day.date}${day.holiday ? " - holiday" : ""}</span></th>`)
                .join("")}
              <th>Description and governance</th>
              <th class="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            ${state.entries.map(renderEntryRow).join("")}
            <tr>
              <td><strong>Daily totals</strong></td>
              ${weekDays
                .map((day) => `<td class="numeric"><strong>${formatHours(dayTotal(day.key))}h</strong></td>`)
                .join("")}
              <td class="muted">Approved data feeds reports, billing and gamification.</td>
              <td class="numeric"><strong>${formatHours(totals.weekTotal)}h</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <h2>Validation summary</h2>
        ${renderValidationSummary(validation)}
      </div>
      <div class="panel pad">
        <h2>Timer</h2>
        <p class="muted">Timers round into draft entries using project or user rounding rules.</p>
        <div class="split-row">
          <div>
            <strong>${state.activeTimer ? "Running on Eskom Sprint delivery" : "No active timer"}</strong>
            <p class="muted">${state.activeTimer ? "Stopping adds 0.25h to Friday for this prototype." : "Start a timer with the current default assignment."}</p>
          </div>
          <button class="button primary" data-action="timer">${state.activeTimer ? "Stop timer" : "Start timer"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderEntryRow(entry) {
  const descriptionError = entryTotal(entry) > 0 && !isQualityDescription(entry.description);
  return `
    <tr>
      <td>
        <div class="entry-meta">
          <span class="entry-title">${entry.project}</span>
          <span class="entry-subtitle">${entry.task} - ${entry.workType}</span>
          <span class="tag">${entry.billable}</span>
        </div>
      </td>
      ${weekDays
        .map((day) => {
          const hours = entry.hours[day.key] ?? 0;
          const error = hours < 0 || hours > 24;
          const warning = day.weekend && hours > 0 && !entry.overtimeAllowed;
          const disabled = state.locked || Boolean(day.holiday);
          return `<td class="numeric">
            <input
              class="hours-input ${error ? "has-error" : warning ? "has-warning" : ""}"
              type="number"
              min="0"
              max="24"
              step="0.25"
              value="${hours}"
              data-entry="${entry.id}"
              data-day="${day.key}"
              ${disabled ? "disabled" : ""}
              aria-label="${entry.project} ${day.label} hours"
            />
            ${day.holiday ? `<span class="inline-message warn">${day.holiday}: disabled by default</span>` : ""}
            ${warning ? `<span class="inline-message warn">Overtime needs PM review</span>` : ""}
            ${error ? `<span class="inline-message error">Hours must be 0-24</span>` : ""}
          </td>`;
        })
        .join("")}
      <td>
        <textarea
          class="description-input ${descriptionError ? "has-error" : ""}"
          data-description="${entry.id}"
          ${state.locked ? "disabled" : ""}
          aria-label="${entry.project} description"
        >${escapeHtml(entry.description)}</textarea>
        <span class="inline-message ${descriptionError ? "error" : "warn"}">
          ${descriptionError ? "Description too short or placeholder-like." : `${entry.rate}; overtime allowed: ${entry.overtimeAllowed ? "yes" : "no"}`}
        </span>
      </td>
      <td class="numeric"><strong>${formatHours(entryTotal(entry))}h</strong></td>
    </tr>
  `;
}

function renderApprovals() {
  return `
    ${renderHeader(
      "Approval by exception",
      "PM approval queue",
      "Auto-approved sheets recede into counts. This queue contains only submissions that failed allocation, overtime, missing-hour, or description rules.",
      `<button class="button primary" data-action="bulk-approve">Bulk approve filtered</button>`
    )}
    <section class="grid four">
      ${metric("Auto-approved", "42", "Current period", "ok")}
      ${metric("Awaiting PM", `${state.exceptionQueue.length}`, "Exception items", state.exceptionQueue.length ? "warn" : "ok")}
      ${metric("Returned", "1", "Needs consultant action", "warn")}
      ${metric("Manual rate", "13%", "Healthy target below 15%", "ok")}
    </section>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <h2>Exception queue</h2>
        <div class="list">
          ${state.exceptionQueue
            .map(
              (item) => `
                <article class="list-item">
                  <div class="split-row">
                    <div>
                      <strong>${item.person}</strong>
                      <p class="muted">${item.week} - ${item.reason}</p>
                    </div>
                    ${statusChip(item.status)}
                  </div>
                  ${targetMeter(item.hours, item.target)}
                  <div class="actions">
                    <button class="button small primary" data-action="approve" data-id="${item.id}">Approve</button>
                    <button class="button small" data-action="return" data-id="${item.id}">Return</button>
                    <button class="button small danger" data-action="reject" data-id="${item.id}">Reject</button>
                  </div>
                </article>
              `
            )
            .join("") || `<p class="muted">No exceptions waiting for PM review.</p>`}
        </div>
      </div>
      <div class="panel pad">
        <h2>Decision evidence</h2>
        <div class="stack">
          <div class="audit-line"><strong>Validation reasons</strong><span>Allocation breach, overtime policy, missing descriptions, and inactive-project checks are shown before any PM action.</span></div>
          <div class="audit-line"><strong>Commercial source</strong><span>Rates and billable status are inherited from project configuration and are not editable during approval.</span></div>
          <div class="audit-line"><strong>Audit required</strong><span>Approve, reject, return, override, and comment actions append immutable audit records.</span></div>
        </div>
      </div>
    </section>
  `;
}

function renderProjects() {
  return `
    ${renderHeader(
      "Project-governed rules",
      "Eskom Modernisation Programme",
      "Project configuration controls commercial behaviour, allocation targets, DevOps sync, compliance rules and activation state.",
      `<button class="button">Validate activation</button><button class="button primary">Publish changes</button>`
    )}
    <section class="grid three">
      ${metric("Budget consumed", "61%", "1,228 of 2,000 approved hours", "info")}
      ${metric("Team allocation", "100%", "Justice J 100%, Alex G 100%", "ok")}
      ${metric("Project state", "Active", "Time logging and DevOps sync enabled", "ok")}
    </section>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <h2>Commercial configuration</h2>
        <div class="form-grid">
          ${readonlyField("Billing model", "Time and Materials")}
          ${readonlyField("Currency", "ZAR")}
          ${readonlyField("VAT", "15%")}
          ${readonlyField("Default billable", "Yes, from project config")}
          ${readonlyField("Overtime", "Disabled for billing and points")}
          ${readonlyField("Approval workflow", "Auto-approve compliant, exception queue otherwise")}
        </div>
      </div>
      <div class="panel pad">
        <h2>Compliance rules</h2>
        <div class="list">
          <div class="list-item"><strong>Description quality</strong><span class="muted">Minimum 20 characters and action-oriented content. Placeholder text is blocked.</span></div>
          <div class="list-item"><strong>Allocation adherence</strong><span class="muted">Alex G target is 32h this holiday-adjusted week. Over-allocation is warning by default.</span></div>
          <div class="list-item"><strong>State machine</strong><span class="muted">Draft, Configuring, Validating, Active, On Hold, Closed, Archived.</span></div>
        </div>
      </div>
    </section>
    <section class="panel pad" style="margin-top:14px">
      <h2>Project workspace</h2>
      <div class="kanban">
        ${["Configuration", "Tasks", "Team allocation", "Audit history"]
          .map(
            (col, index) => `
              <div class="kanban-col">
                <h3>${col}</h3>
                <div class="list-item">
                  <strong>${["Commercial rules", "Sprint delivery", "Alex G - Developer", "Activation audit"][index]}</strong>
                  <span class="muted">${["Server resolves billable, rate and overtime.", "Active task appears in timesheet selection.", "100% allocation, 32h expected this week.", "All state transitions are append-only."][index]}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCapacity() {
  const people = [
    ["Justice J", "Business Analyst", 100, 32, 28],
    ["Alex G", "Developer", 100, 32, calculateTotals().eskomTotal],
    ["Connor C", "Project Manager", 0, 0, 0],
    ["Mia T", "Tester", 50, 16, 12]
  ];

  return `
    ${renderHeader(
      "Resource allocation",
      "Capacity and allocation board",
      "Allocation contracts calculate weekly targets and block assignments that exceed 100%. Holidays and approved leave reduce expected hours.",
      `<button class="button">Run what-if</button><button class="button primary">Resolve conflicts</button>`
    )}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Person</th><th>Role</th><th class="numeric">Allocation</th><th class="numeric">Target</th><th class="numeric">Actual</th><th>Adherence</th></tr></thead>
        <tbody>
          ${people
            .map(
              ([name, role, allocation, target, actual]) => `
                <tr>
                  <td><strong>${name}</strong></td>
                  <td>${role}</td>
                  <td class="numeric">${allocation}%</td>
                  <td class="numeric">${formatHours(target)}h</td>
                  <td class="numeric">${formatHours(actual)}h</td>
                  <td>${targetMeter(actual, Math.max(target, 1))}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDevOps() {
  return `
    ${renderHeader(
      "Native Azure DevOps sync",
      "Work item refresh and preview",
      "INTRVL pulls active assigned work items, normalises ticket data, maps work types, and creates draft timesheet suggestions only after human review.",
      `<button class="button" data-action="refresh-devops">Refresh</button><button class="button primary" data-action="accept-devops">Accept mapped</button>`
    )}
    <section class="grid three">
      ${metric("Connection", "Connected", "PAT validated, user match confirmed", "ok")}
      ${metric("Retrieved", `${devopsTickets.length}`, "Active assigned tickets", "info")}
      ${metric("Mapping health", "67%", "One unmapped ticket requires review", "warn")}
    </section>
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead><tr><th>Ticket</th><th>Status</th><th>Description</th><th>Work type</th><th class="numeric">Estimate</th><th>Mapping</th><th>Action</th></tr></thead>
        <tbody>
          ${devopsTickets
            .map(
              (ticket) => `
                <tr>
                  <td><strong>${ticket.id}</strong></td>
                  <td>${statusChip(ticket.status)}</td>
                  <td>${ticket.title}</td>
                  <td>${ticket.workType}</td>
                  <td class="numeric">${ticket.estimate}h</td>
                  <td>${statusChip(ticket.mapped ? "Mapped" : "Unmapped")}</td>
                  <td><button class="button small" data-action="accept-ticket" data-ticket="${ticket.id}" ${ticket.mapped ? "" : "disabled"}>Accept</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReports() {
  return `
    ${renderHeader(
      "Approved-data analytics",
      "Reporting and profitability",
      "Dashboards read only approved or auto-approved data. Draft and rejected entries are excluded by construction.",
      `<button class="button">Export CSV</button><button class="button primary">Share report</button>`
    )}
    <section class="grid three">
      ${metric("Utilisation", "88%", "Approved hours over adjusted capacity", "ok")}
      ${metric("Billable ratio", "81%", "Project-governed billable classification", "info")}
      ${metric("Margin forecast", "36%", "Based on approved timesheets and rate card", "ok")}
    </section>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <h2>Weekly utilisation trend</h2>
        <div class="chart">
          ${[72, 78, 81, 86, 88, 91, 84, 88]
            .map((value, index) => `<div class="bar"><span style="height:${value}%"></span><label>W${index + 18}</label></div>`)
            .join("")}
        </div>
      </div>
      <div class="panel pad">
        <h2>Report library</h2>
        <div class="list">
          ${["Timesheet compliance", "Allocation adherence", "Project profitability", "Invoice evidence", "Gamification fairness"]
            .map((report) => `<div class="list-item"><strong>${report}</strong><span class="muted">Scoped by ${state.role} permissions.</span></div>`)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderInvoicing() {
  return `
    ${renderHeader(
      "Billing evidence",
      "Invoice workbench",
      "Invoices are generated from approved timesheet snapshots. Issued invoices become immutable and carry supporting annexures.",
      `<button class="button">Preview annexure</button><button class="button primary">Generate draft</button>`
    )}
    <section class="grid four">
      ${metric("Draft invoices", "3", "Awaiting finance review", "info")}
      ${metric("Approved hours", "184h", "Current billing period", "ok")}
      ${metric("Uninvoiced value", "ZAR 230k", "No double-bill links found", "ok")}
      ${metric("Receivables", "ZAR 96k", "One overdue client", "warn")}
    </section>
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead><tr><th>Client</th><th>Project</th><th class="numeric">Hours</th><th class="numeric">Value</th><th>Status</th><th>Evidence</th></tr></thead>
        <tbody>
          <tr><td>Eskom</td><td>Eskom Modernisation Programme</td><td class="numeric">128h</td><td class="numeric">ZAR 158,600</td><td>${statusChip("Draft")}</td><td>Timesheet snapshot, task annexure, approval audit</td></tr>
          <tr><td>Internal</td><td>Operations</td><td class="numeric">18h</td><td class="numeric">ZAR 0</td><td>${statusChip("Excluded")}</td><td>Non-billable from project config</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderEngage() {
  return `
    ${renderHeader(
      "Compliance engagement",
      "Points, badges and streaks",
      "Gamification uses only approved data and respects project rules. Overtime points are disabled when a project disallows overtime.",
      `<button class="button primary">View leaderboard</button>`
    )}
    <section class="grid four">
      ${metric("Points", "1,240", "Approved compliant entries only", "ok")}
      ${metric("Current streak", "6 weeks", "Submitted by Friday 16:00", "ok")}
      ${metric("Badges", "9", "Latest: Allocation Pro", "info")}
      ${metric("Overtime points", "0", "Disabled by Eskom project rules", "warn")}
    </section>
    <section class="grid three" style="margin-top:14px">
      ${["Allocation Pro", "Friday Finisher", "Description Quality", "DevOps Syncer", "Auto-Approval Streak", "Audit Ready"]
        .map((badge) => `<div class="panel pad metric"><span class="status-chip ok">Awarded</span><strong>${badge}</strong><span class="metric-note">Triggered after approval, never from draft data.</span></div>`)
        .join("")}
    </section>
  `;
}

function renderAdmin() {
  return `
    ${renderHeader(
      "Platform governance",
      "Administration",
      "Manage users, roles, global work rules, AI configuration, schedulers, integrations, and immutable audit trails.",
      `<button class="button">Run scheduler</button><button class="button primary">Create user</button>`
    )}
    <section class="grid three">
      ${metric("Users", "18", "3 UAT seed personas active", "ok")}
      ${metric("Schedulers", "7", "Auto-submit, DevOps, notifications, projections", "info")}
      ${metric("Audit integrity", "100%", "Hash-chain records intact", "ok")}
    </section>
    <section class="grid two" style="margin-top:14px">
      <div class="panel pad">
        <h2>Global rules</h2>
        <div class="form-grid">
          ${readonlyField("Country", "South Africa")}
          ${readonlyField("Timezone", "Africa/Johannesburg")}
          ${readonlyField("Standard day", "8h")}
          ${readonlyField("Standard week", "40h")}
        </div>
      </div>
      <div class="panel pad">
        <h2>Audit ledger</h2>
        <div class="stack">
          ${state.audit.map((line) => `<div class="audit-line">${line}</div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderCopilot() {
  return `
    <aside class="copilot" aria-label="AI copilot">
      <div class="copilot-card">
        <div class="copilot-head">
          <div class="split-row">
            <div>
              <strong>AI copilot</strong>
              <div class="muted">Permission-scoped assistant</div>
            </div>
            ${statusChip("Audited")}
          </div>
        </div>
        <div class="copilot-body">
          ${state.messages
            .map((message) => `<div class="message ${message.who}">${escapeHtml(message.text)}</div>`)
            .join("")}
        </div>
        <div class="copilot-foot">
          <div class="copilot-input">
            <textarea data-copilot-input placeholder="Ask to fill missing hours, explain warnings, or improve descriptions"></textarea>
            <div class="actions">
              <button class="button small" data-action="copilot-explain">Explain validation</button>
              <button class="button small primary" data-action="copilot-send">Send</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderValidationSummary(validation) {
  if (!validation.items.length) {
    return `<div class="list-item">${statusChip("Compliant")}<span>Ready for auto-approval. Submission will lock the week and queue downstream sync.</span></div>`;
  }

  return `
    <div class="list">
      ${validation.items
        .map(
          (item) => `
            <div class="list-item">
              <div class="split-row"><strong>${item.title}</strong>${statusChip(item.severity === "error" ? "Block" : "Warning")}</div>
              <span class="muted">${item.message}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      state.route = button.dataset.route;
      render();
    });
  });

  const roleSwitcher = app.querySelector(".role-switcher");
  roleSwitcher?.addEventListener("change", (event) => {
    state.role = event.target.value;
    toast(`Switched to ${state.role} role context.`, "ok");
    render();
  });

  app.querySelectorAll("[data-entry][data-day]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const entry = state.entries.find((item) => item.id === input.dataset.entry);
      entry.hours[input.dataset.day] = Number(event.target.value || 0);
      updateTimesheetStatus();
      render();
    });
  });

  app.querySelectorAll("[data-description]").forEach((input) => {
    input.addEventListener("input", () => {
      const entry = state.entries.find((item) => item.id === input.dataset.description);
      entry.description = input.value;
      updateTimesheetStatus();
    });
    input.addEventListener("blur", render);
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset));
  });
}

function handleAction(action, dataset = {}) {
  if (action === "ai-fill") return aiFillMissing();
  if (action === "submit") return submitTimesheet();
  if (action === "timer") return toggleTimer();
  if (action === "accept-devops") return acceptDevOps(true);
  if (action === "accept-ticket") return acceptDevOps(false, dataset.ticket);
  if (action === "refresh-devops") return refreshDevOps();
  if (action === "approve") return resolveException(dataset.id, "approved");
  if (action === "return") return resolveException(dataset.id, "returned with comments");
  if (action === "reject") return resolveException(dataset.id, "rejected");
  if (action === "bulk-approve") return bulkApprove();
  if (action === "copilot-explain") return explainValidation();
  if (action === "copilot-send") return sendCopilotMessage();
}

function aiFillMissing() {
  const eskom = state.entries.find((entry) => entry.id === "eskom-dev");
  const missing = Math.max(32 - entryTotal(eskom), 0);
  const fillableDays = weekDays.filter((day) => !day.holiday && !day.weekend);
  let remaining = missing;

  for (const day of fillableDays) {
    if (remaining <= 0) break;
    const current = eskom.hours[day.key] || 0;
    const room = Math.max(8 - current, 0);
    const add = Math.min(room, remaining);
    eskom.hours[day.key] = current + add;
    remaining -= add;
  }

  if (!isQualityDescription(eskom.description)) {
    eskom.description =
      "Delivered active sprint work, updated implementation notes, and validated allocation compliance.";
  }

  updateTimesheetStatus();
  addMessage("ai", "I filled missing working-day hours without touching the Youth Day holiday or exceeding the Eskom allocation target.");
  toast("AI suggestions accepted into draft timesheet.", "ok");
  render();
}

function submitTimesheet() {
  const validation = validateTimesheet();
  if (validation.blocks) {
    toast("Submission blocked. Resolve validation errors first.", "warn");
    addMessage("ai", "Submission is blocked because at least one entry fails the master validation rules. Check the validation summary for the exact cells.");
    render();
    return;
  }

  state.locked = true;
  state.timesheetStatus = validation.warnings ? "Awaiting PM Review" : "Auto-Approved";
  state.audit.unshift(`2026-06-19 16:00 - ${state.timesheetStatus} transition recorded for ${state.week}`);
  if (validation.warnings) {
    state.exceptionQueue.unshift({
      id: `ts-current-${Date.now()}`,
      person: "Alex G",
      week: state.week,
      reason: validation.items.map((item) => item.title).join(", "),
      hours: calculateTotals().weekTotal,
      target: calculateTotals().expected,
      status: "Awaiting PM approval"
    });
  }
  toast(`${state.timesheetStatus}. Week is now locked.`, "ok");
  render();
}

function toggleTimer() {
  const eskom = state.entries.find((entry) => entry.id === "eskom-dev");
  if (!state.activeTimer) {
    state.activeTimer = { startedAt: new Date().toISOString(), entryId: eskom.id };
    toast("Timer started for Eskom Sprint delivery.", "ok");
  } else {
    eskom.hours.fri = Number((eskom.hours.fri + 0.25).toFixed(2));
    state.activeTimer = null;
    updateTimesheetStatus();
    toast("Timer stopped and rounded 0.25h into Friday.", "ok");
  }
  render();
}

function acceptDevOps(all, ticketId) {
  const eskom = state.entries.find((entry) => entry.id === "eskom-dev");
  const accepted = devopsTickets.filter((ticket) => ticket.mapped && (all || ticket.id === ticketId));
  if (!accepted.length) {
    toast("No mapped DevOps tickets selected.", "warn");
    return;
  }
  eskom.description = accepted.map((ticket) => `[${ticket.id}] - ${ticket.title}`).join("; ");
  eskom.hours.fri = Math.max(eskom.hours.fri, Math.min(8, accepted.reduce((sum, ticket) => sum + ticket.estimate, 0)));
  updateTimesheetStatus();
  state.route = "timesheets";
  toast(`${accepted.length} DevOps ticket${accepted.length === 1 ? "" : "s"} accepted into draft.`, "ok");
  render();
}

function refreshDevOps() {
  state.audit.unshift("2026-06-19 16:11 - Manual Azure DevOps refresh completed with preview rows");
  toast("Azure DevOps refresh completed.", "ok");
  render();
}

function resolveException(id, outcome) {
  const item = state.exceptionQueue.find((exception) => exception.id === id);
  if (!item) return;
  state.exceptionQueue = state.exceptionQueue.filter((exception) => exception.id !== id);
  state.audit.unshift(`2026-06-19 16:12 - ${item.person} ${item.week} ${outcome} by ${state.role}`);
  toast(`Exception ${outcome}.`, outcome === "approved" ? "ok" : "warn");
  render();
}

function bulkApprove() {
  const count = state.exceptionQueue.length;
  state.exceptionQueue = [];
  state.audit.unshift(`2026-06-19 16:13 - Bulk approved ${count} filtered approval exceptions`);
  toast(`Bulk approved ${count} exception${count === 1 ? "" : "s"}.`, "ok");
  render();
}

function explainValidation() {
  const validation = validateTimesheet();
  const text = validation.items.length
    ? `Current validation has ${validation.blocks} block(s) and ${validation.warnings} warning(s): ${validation.items
        .map((item) => item.title)
        .join("; ")}.`
    : "Current validation is clean. Submission will auto-approve and lock the week.";
  addMessage("ai", text);
  render();
}

function sendCopilotMessage() {
  const input = app.querySelector("[data-copilot-input]");
  const text = input?.value.trim();
  if (!text) return;
  addMessage("user", text);
  if (/fill|missing/i.test(text)) {
    aiFillMissing();
    return;
  }
  addMessage(
    "ai",
    "I checked your role scope and current week. I can assist with timesheet capture, DevOps preview, compliance explanations and project-safe suggestions."
  );
  render();
}

function addMessage(who, text) {
  state.messages.push({ who, text });
}

function toast(text, kind = "ok") {
  state.toasts.push({ text, kind });
  window.setTimeout(() => {
    state.toasts.shift();
    render();
  }, 2600);
}

function calculateTotals() {
  const weekTotal = state.entries.reduce((sum, entry) => sum + entryTotal(entry), 0);
  const eskomTotal = state.entries
    .filter((entry) => entry.project === "Eskom Modernisation Programme")
    .reduce((sum, entry) => sum + entryTotal(entry), 0);
  const expected = 32;
  return { weekTotal, eskomTotal, expected };
}

function entryTotal(entry) {
  return Object.values(entry.hours).reduce((sum, value) => sum + Number(value || 0), 0);
}

function dayTotal(dayKey) {
  return state.entries.reduce((sum, entry) => sum + Number(entry.hours[dayKey] || 0), 0);
}

function validateTimesheet() {
  const items = [];
  for (const entry of state.entries) {
    for (const day of weekDays) {
      const hours = Number(entry.hours[day.key] || 0);
      if (hours < 0 || hours > 24) {
        items.push({
          severity: "error",
          title: "Invalid hours",
          message: `${entry.project} on ${day.label}: hours must be greater than or equal to 0 and less than or equal to 24.`
        });
      }
      if (day.holiday && hours > 0) {
        items.push({
          severity: "warn",
          title: "Holiday work requires review",
          message: `${day.holiday} is excluded from expected hours. Manual time is allowed but routes to PM review.`
        });
      }
      if (day.weekend && hours > 0 && !entry.overtimeAllowed) {
        items.push({
          severity: "warn",
          title: "Overtime not allowed for this project",
          message: `${entry.project} has overtime disabled; extra time will require PM review and earns no overtime points.`
        });
      }
    }
    if (entryTotal(entry) > 0 && !isQualityDescription(entry.description)) {
      items.push({
        severity: "error",
        title: "Description too short",
        message: `${entry.project}: add an action-oriented description with at least 20 characters.`
      });
    }
  }

  const totals = calculateTotals();
  if (totals.eskomTotal < 32) {
    items.push({
      severity: "warn",
      title: "Allocation target not met",
      message: `Eskom allocation target is 32h for the holiday-adjusted week; current approved draft total is ${formatHours(totals.eskomTotal)}h.`
    });
  }
  if (totals.weekTotal < totals.expected) {
    items.push({
      severity: "warn",
      title: "Missing expected hours",
      message: `Expected ${formatHours(totals.expected)}h after Youth Day; current total is ${formatHours(totals.weekTotal)}h.`
    });
  }

  return {
    items,
    blocks: items.filter((item) => item.severity === "error").length,
    warnings: items.filter((item) => item.severity === "warn").length
  };
}

function updateTimesheetStatus() {
  const validation = validateTimesheet();
  if (state.locked) return;
  if (validation.blocks) state.timesheetStatus = "Validation Warning";
  else if (validation.warnings) state.timesheetStatus = "Ready with Warnings";
  else state.timesheetStatus = "Compliant";
}

function isQualityDescription(description) {
  if (!description || description.trim().length < 20) return false;
  return !/^(meeting|dev work|testing|admin|work)$/i.test(description.trim());
}

function projectStatus(entry, total) {
  if (!entry.allocation && total === 0) return "Available";
  if (total > entry.allocation && entry.allocation > 0) return "Over target";
  if (entry.allocation > 0 && total < entry.allocation) return "Under target";
  return "On target";
}

function metric(label, value, note, status = "info") {
  return `
    <div class="panel pad metric">
      ${statusChip(statusLabel(status))}
      <div class="metric-value">${value}</div>
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-note">${note}</div>
      </div>
    </div>
  `;
}

function workflowCard(title, copy, action, route) {
  return `
    <article class="panel pad">
      <h2>${title}</h2>
      <p class="muted">${copy}</p>
      <button class="button" data-route="${route}">${action}</button>
    </article>
  `;
}

function readonlyField(label, value) {
  return `<div class="field"><label>${label}</label><div class="readonly-box">${value}</div></div>`;
}

function targetMeter(actual, target) {
  const pct = target <= 0 ? 100 : Math.min((actual / target) * 100, 130);
  const className = actual > target * 1.1 ? "error" : actual < target ? "warn" : "";
  return `
    <div style="min-width:180px">
      <div class="target-bar ${className}" aria-hidden="true"><span style="width:${Math.min(pct, 100)}%"></span></div>
      <div class="metric-note">${formatHours(actual)}h / ${formatHours(target)}h</div>
    </div>
  `;
}

function statusChip(label) {
  const lower = String(label).toLowerCase();
  let className = "info";
  if (/auto|active|ok|mapped|compliant|approved|awarded|on target|connected|audited/.test(lower)) className = "ok";
  if (/warn|under|awaiting|draft|unmapped|returned|missing|available|ready/.test(lower)) className = "warn";
  if (/block|error|reject|over|disabled|excluded/.test(lower)) className = "error";
  return `<span class="status-chip ${className}">${label}</span>`;
}

function statusLabel(status) {
  if (status === "ok") return "Healthy";
  if (status === "warn") return "Needs attention";
  if (status === "error") return "Blocked";
  return "Info";
}

function formatHours(value) {
  return Number(value || 0).toFixed(Number(value || 0) % 1 === 0 ? 0 : 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
