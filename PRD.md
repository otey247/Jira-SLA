# Product Requirements Document

## Product Name

Jira SLA Analytics and Rovo Surface App

## Document Purpose

This PRD defines the product requirements for a Forge-based Jira application that calculates deterministic SLA and active handling time metrics from Jira changelog, worklog, and assignment history, exposes those metrics through a custom UI inside Jira, and optionally surfaces curated query and explanation capabilities through Rovo.

This document is intended to be implementation-ready for a GitHub Copilot Coding Agent or engineering team.

---

# 1. Executive Summary

## 1.1 Problem Statement

The team needs a reliable way to measure true consultant and team handling time for Jira tickets. Native Jira worklog and common reporting approaches do not fully satisfy the business requirement because they rely on manual data entry, do not consistently pause and resume across assignment and status changes, and do not automatically apply account-specific business-hour calendars.

The product must compute authoritative SLA and handling-time results by reconstructing ticket timelines from Jira issue history and applying explicit business rules.

## 1.2 Product Vision

Build an Atlassian-native Forge app that:

* Uses Jira issue history as the source of truth
* Applies deterministic, configurable SLA rules
* Persists segment-level and summary-level computed metrics
* Provides an explainable UI for issue-level and aggregate reporting
* Optionally exposes stable, action-based query capabilities through Rovo

## 1.3 Product Outcome

Users should be able to answer questions such as:

* When did SLA start for this ticket?
* How much true active handling time did the consultant spend?
* When and why did the timer pause?
* How much time was spent by each assignee?
* What was counted during business hours versus elapsed wall-clock time?
* Which tickets breached SLA and why?

---

# 2. Goals and Non-Goals

## 2.1 Goals

1. Compute deterministic SLA metrics from Jira issue history.
2. Support pause, resume, stop, and business-hour logic.
3. Provide issue-level explainability for every computed result.
4. Provide project-level reporting and analytics.
5. Support account-specific rule sets and calendars.
6. Support a phased path to Rovo-based conversational access.
7. Remain Atlassian-native using Forge.

## 2.2 Non-Goals

1. Do not replace Jira’s built-in ticketing workflows.
2. Do not attempt to make LLMs the primary SLA calculation engine.
3. Do not rely solely on manual worklogs as the authoritative source of truth.
4. Do not build a generic external BI platform in the first release.
5. Do not support every conceivable Jira customization in the first release.

---

# 3. Users and Personas

## 3.1 Primary Users

### Delivery Manager

Needs to measure consultant response and handling performance, identify breaches, and report trends.

### Team Lead

Needs to understand where tickets are pausing, how long work is actually taking, and which consultants or queues need attention.

### Consultant / Analyst

Needs visibility into how SLA is being measured for assigned work and why time is being counted or paused.

### Jira / Platform Admin

Needs to configure rule sets, calendars, mappings, and recomputation behavior.

## 3.2 Secondary Users

### Executive / Account Leadership

Needs dashboard-level summaries and breach reporting.

### Rovo End User

Needs natural-language access to stable SLA summaries and explanations.

---

# 4. Core Business Requirements

## 4.1 Main Requirement

The application must measure true active handling time and SLA time for tracked Jira work based on assignment, status transitions, and customer-defined business rules.

## 4.2 Functional Interpretation

The application must:

* Start SLA when a tracked assignment condition occurs
* Continue timing only while ownership and active conditions are satisfied
* Pause timing when the ticket moves into a paused condition or leaves tracked ownership
* Resume timing when active conditions reoccur
* Support multiple pause/resume cycles for the same ticket
* Aggregate total active time across segments
* Support business-hours-only and 24x7 timing modes
* Support priority-specific timing behavior
* Explain every computed result through an audit timeline

## 4.3 Illustrative Rules

Examples of supported rules include:

* Start SLA on assignment to Capgemini team or tracked consultant
* Count response time from assignment until first active work condition
* Pause handling time when ticket status changes to blocked, waiting for info, or equivalent state
* Pause handling time when ticket is reassigned away from tracked ownership
* Resume handling time when ticket returns to tracked ownership and an eligible active status
* Count only IST shift hours for standard tickets
* Count 24x7 elapsed time for critical incidents if configured

---

# 5. Product Scope

## 5.1 In Scope for MVP

1. Forge app with Jira project page
2. Forge app with Jira issue panel
3. Custom Entity Store persistence
4. Deterministic SLA computation engine
5. Scheduled background recomputation
6. Manual issue rebuild capability
7. One or more configurable rule sets
8. One or more configurable business calendars
9. Project-level reporting UI
10. Issue-level timeline explainability UI
11. CSV export for filtered results
12. Jira dashboard gadget
13. Atlassian Automation custom action
14. Event-driven recalculation in addition to scheduled polling
15. Rovo agent with curated actions
16. Aggregate cache tables for faster rollups
17. Multi-project rule inheritance and administration enhancements

## 5.3 Out of Scope for MVP

1. Marketplace publication
2. External warehouse synchronization
3. Full no-code rule builder with arbitrary expression language
4. Predictive or probabilistic SLA breach forecasting
5. Auto-remediation or workflow changes in Jira

---

# 6. Product Principles

1. Deterministic over inferential
2. Explainable over opaque
3. Configurable over hardcoded
4. Incremental processing over expensive full recomputation
5. Atlassian-native over external-first
6. Rovo as a consumer of computed truth, not the source of truth

---

# 7. User Stories

## 7.1 Delivery Manager

* As a delivery manager, I want to see average response time and active handling time by consultant so that I can assess performance accurately.
* As a delivery manager, I want to see which tickets breached configured SLA so that I can follow up with the right team.
* As a delivery manager, I want to export filtered results so that I can share them with stakeholders.

## 7.2 Team Lead

* As a team lead, I want to understand where a ticket paused and resumed so that I can investigate delays.
* As a team lead, I want to see time counted by assignee and state so that I can identify bottlenecks.

## 7.3 Consultant

* As a consultant, I want to see how the system calculated my active handling time so that I can trust the result.

## 7.4 Admin

* As an admin, I want to configure which statuses are active, paused, or stopped so that the app matches our operating model.
* As an admin, I want to define business calendars and priority overrides so that timing is calculated correctly.
* As an admin, I want to trigger recomputation for a specific issue or date range so that I can repair historical data after a rules change.

## 7.5 Rovo End User

* As a Rovo user, I want to ask why a ticket is paused and receive a deterministic explanation based on computed data.

---

# 8. End-to-End Workflows

## 8.1 Ticket Recompute Workflow

1. Jira issue is created, updated, transitioned, or reassigned.
2. A scheduled job or later an event-driven trigger selects issues needing recomputation.
3. The backend fetches current issue data and changelog deltas.
4. The backend normalizes history into an ordered event stream.
5. The rules engine evaluates each interval and emits segments.
6. The backend aggregates segments into a summary.
7. The backend writes checkpoint, segment, and summary records.
8. The UI reads the computed results.

## 8.2 Admin Rule Update Workflow

1. Admin updates a rule set or calendar.
2. System versions the new rule set.
3. Admin selects whether to mark affected issues for rebuild.
4. Scheduled or manual recomputation updates derived results.

## 8.3 Issue Investigation Workflow

1. User opens a Jira issue.
2. Issue panel loads computed summary.
3. User views active time, paused time, response time, and breach state.
4. User expands timeline for explanation.
5. User can trigger rebuild if data appears outdated.

## 8.4 Agent Query Workflow

1. User asks a natural-language question.
2. Rovo agent selects a bounded action.
3. Action queries computed summaries or timeline data.
4. Agent returns deterministic results and explanation.

---

# 9. Functional Requirements

## 9.1 Jira Integration

The application must:

1. Retrieve Jira issue metadata
2. Retrieve Jira issue changelog history
3. Retrieve Jira worklogs for optional comparison and audit views
4. Support project-level filtering based on Jira project and issue attributes

## 9.2 Rules Engine

The application must support configurable rules for:

1. SLA start conditions
2. Active handling conditions
3. Pause conditions
4. Stop conditions
5. Resume conditions
6. Ownership scope
7. Business calendars
8. Priority overrides
9. Response-time logic versus handling-time logic

## 9.3 Timeline Segmentation

The application must convert issue history into explicit time segments.
Each segment must include:

* issue key
* rule set version
* assignee
* team label
* status
* priority
* segment type
* start time
* end time
* raw duration
* business-hours duration
* source history references if available

## 9.4 Summary Computation

The application must compute issue-level summary metrics including:

* response time
* active handling time
* paused time
* outside-hours time
* current SLA state
* breach state
* current assignee
* current priority

## 9.5 Project Reporting

The application must provide project-level analytics with:

* filters
* sortable issue table
* aggregated metrics
* drill-down into issue timelines
* export capability

## 9.6 Explainability

The application must provide a human-readable explanation of:

* when SLA started
* when SLA paused
* when SLA resumed
* which rule caused each decision
* how business-hours adjustments were applied

## 9.7 Administration

The application must provide admin screens or forms for:

* rule set management
* business calendar management
* project-to-rule-set mapping
* rebuild controls

## 9.8 Recalculation

The application must support:

* scheduled background recomputation
* manual issue rebuild
* manual project/date-range rebuild
* idempotent recomputation

## 9.9 Rovo Integration

The application must support bounded Rovo actions that query precomputed data.
At minimum, the architecture must support future actions for:

* get issue SLA summary
* explain issue timeline
* list breached issues
* get assignee metrics

---

# 10. Non-Functional Requirements

## 10.1 Reliability

* Recomputations must be idempotent.
* The system must not double-count time when reprocessing the same changelog range.
* Stored summaries must always be traceable back to segments.

## 10.2 Performance

* Issue panel should load summary information quickly from persisted data.
* Project page should use filtered summary queries, not raw changelog scans.
* Recompute jobs should process incrementally wherever possible.

## 10.3 Scalability

* The system should support multiple projects and rule sets.
* The data model should support future aggregate caching.
* Avoid storing full raw changelog payloads long term unless necessary for debugging.

## 10.4 Security

* Respect Jira and Forge permission boundaries.
* Admin functions must be limited to authorized users.
* Rovo actions must only return data the requesting user is allowed to access.

## 10.5 Auditability

* Every summary metric must be explainable through segment-level records.
* Rule-set version used for computation must be persisted.

## 10.6 Maintainability

* Rules engine must be modular and testable.
* UI and compute logic must be decoupled.
* Data schema should be explicit and versionable.

---

# 11. Technical Architecture Requirements

## 11.1 Platform

The solution must use Atlassian Forge.

## 11.2 App Modules

The application should include:

* `jira:projectPage`
* `jira:issuePanel`
* optionally `jira:dashboardGadget`
* `scheduledTrigger`
* later `action` for Automation
* later `rovo:agent`
* later Rovo `action` modules

## 11.3 Frontend

* Use Forge Custom UI with React.
* Provide separate surfaces for project page, issue panel, and optional gadget.
* Use a shared component and data access layer where practical.

## 11.4 Backend

* Use Forge functions for recomputation, queries, admin operations, and Rovo actions.
* Implement a deterministic rules engine in backend code.
* Separate data access, rule evaluation, and aggregation layers.

## 11.5 Storage

* Use Forge Custom Entity Store for structured persistence.
* Optionally use key-value storage for lightweight config or job metadata.
* Use transactions when writing related issue checkpoint, segment, and summary data.

---

# 12. Data Model Requirements

## 12.1 Required Entities

The solution must support at minimum the following logical entities:

### RuleSet

Fields should include:

* ruleSetId
* name
* version
* projectKeys
* trackedTeams or trackedAssignees
* startMode
* activeStatuses
* pausedStatuses
* stoppedStatuses
* resumeRules
* businessCalendarId
* priorityOverrides
* enabled

### BusinessCalendar

Fields should include:

* calendarId
* name
* timezone
* workingDays
* workingHours
* holidays
* afterHoursMode
* priorityModeOverrides

### IssueCheckpoint

Fields should include:

* issueKey
* ruleSetId
* lastProcessedChangelogId
* lastIssueUpdatedTimestamp
* lastRecomputedAt
* summaryVersion
* needsRebuild

### IssueSegment

Fields should include:

* segmentId
* issueKey
* ruleSetId
* ruleVersion
* assigneeAccountId
* teamLabel
* status
* priority
* segmentType
* startedAt
* endedAt
* rawSeconds
* businessSeconds
* sourceEventStart
* sourceEventEnd

### IssueSummary

Fields should include:

* issueKey
* ruleSetId
* ruleVersion
* currentState
* responseSeconds
* activeSeconds
* pausedSeconds
* outsideHoursSeconds
* breachState
* currentAssignee
* currentPriority
* recomputedAt

### AggregateDaily

Fields should include:

* date
* projectKey
* assigneeAccountId
* teamLabel
* priority
* ticketCount
* avgResponseSeconds
* avgActiveSeconds
* breachCount

## 12.2 Data Integrity Requirements

* Segments for the same issue must not overlap in contradictory ways.
* Summary values must equal aggregation of applicable segments.
* Rebuilds must replace or supersede prior derived results safely.

---

# 13. Rules Engine Requirements

## 13.1 Event Inputs

The rules engine must evaluate an ordered stream of normalized issue events, including at minimum:

* issue created
* assignee changed
* status changed
* priority changed
* resolution set or cleared

## 13.2 Evaluation Behavior

The rules engine must:

1. Determine tracked ownership at every interval
2. Determine active, paused, stopped, or outside-hours state at every interval
3. Split intervals when ownership, status, priority, or business-hours boundaries change
4. Compute raw and business-hours durations for each segment
5. Aggregate segments into summary metrics

## 13.3 Rule Flexibility

The rules engine must support:

* assignment-based SLA start
* status-based SLA start
* hybrid rules where response and handling use different start logic
* pause on tracked status or ownership loss
* resume on tracked status and ownership return
* business-hour and 24x7 modes
* priority-specific overrides

## 13.4 Explainability Requirement

The rules engine must be able to return machine-readable and human-readable reasons for segment boundaries and SLA state changes.

---

# 14. UI/UX Requirements

## 14.1 Jira Project Page

The project page must include:

* summary KPI section
* filters for project, assignee, team, priority, date range, breach state, status
* issue results table
* drill-down for selected issue
* links into issue detail where appropriate
* CSV export

### Suggested Tabs

* Overview
* Issue Explorer
* Assignee Analytics
* Rule Sets
* Calendars
* Rebuild Jobs
* Audit

## 14.2 Jira Issue Panel

The issue panel must display:

* SLA start time
* response time
* active handling time
* paused time
* current clock state
* breach state
* current assignee
* timeline of segments
* explanation of pauses and resumes
* manual rebuild action if permitted

## 14.3 Dashboard Gadget

If implemented, the gadget should show:

* average response time by assignee
* average active time by team
* breach count by priority
* trend charts over time

## 14.4 Admin Screens

Admin UI must support:

* create and edit rule sets
* create and edit calendars
* map projects to rule sets
* trigger rebuilds
* view rebuild history or status

## 14.5 UX Principles

* Emphasize clarity and auditability
* Avoid hidden calculations
* Surface exact timestamps and rule decisions
* Prefer explicit labels over shorthand

---

# 15. API / Function Requirements

## 15.1 Backend Functions

The application should provide backend functions equivalent to:

* `syncIssueHistory(issueKey)`
* `recomputeIssueSla(issueKey)`
* `recomputeProjectWindow(projectKey, dateRange)`
* `getIssueSummary(issueKey)`
* `getIssueTimeline(issueKey)`
* `searchIssueSummaries(filters)`
* `saveRuleSet(ruleSetPayload)`
* `saveBusinessCalendar(calendarPayload)`
* `markIssueForRebuild(issueKey)`
* `automationRecompute(payload)`
* `rovoGetIssueSummary(issueKey)`
* `rovoExplainIssue(issueKey)`
* `rovoListBreaches(filters)`

## 15.2 Function Behavior

* Query functions must read from persisted derived data, not recompute by default.
* Recompute functions must be safe to rerun.
* Admin update functions must validate payloads and version changes.

---

# 16. Reporting Requirements

The reporting layer must support:

* filtering by project, assignee, team, priority, date range, and breach state
* sorting by response time, active handling time, paused time, and breach state
* aggregate metrics by assignee, team, and day
* export of issue-level result sets

Potential future requirements:

* scheduled emailed summaries
* saved report views
* breach trend comparisons across periods

---

# 17. Error Handling Requirements

The system must handle:

* missing or incomplete changelog records gracefully
* rule sets that no longer match a project cleanly
* issues with unsupported or unknown statuses
* recomputation failures without corrupting existing summaries
* partial project rebuild failures with retry support

Errors should be logged and, where appropriate, visible in admin diagnostics.

---

# 18. Observability Requirements

The application should log and track:

* recompute job start and completion
* issue count processed
* failures per issue
* rule set version used
* duration of recompute job
* stale checkpoint count

Admin views should expose enough information to troubleshoot stale or failed recomputations.

---

# 19. Security and Permissions

## 19.1 Access Control

* General users may view only project and issue data they are already authorized to access in Jira.
* Admin configuration screens must be restricted to authorized admins.
* Rebuild actions should be permission-controlled.

## 19.2 Data Handling

* Do not expose raw data through Rovo beyond what the user is authorized to access.
* Avoid storing unnecessary personal data beyond account identifiers needed for reporting.

---

# 20. Testing Requirements

## 20.1 Unit Tests

Must cover:

* rules engine interval splitting
* pause and resume logic
* business-hours calculations
* priority overrides
* summary aggregation
* rule versioning behavior

## 20.2 Integration Tests

Must cover:

* Jira issue retrieval and changelog parsing
* recompute pipeline from issue to persisted summary
* issue panel data retrieval
* project page filtered queries
* admin updates and rebuild triggers

## 20.3 End-to-End Tests

Must cover:

* issue transitions causing expected summary updates
* manual rebuild correcting stale data
* Rovo action returning stable results from persisted data

## 20.4 Test Fixtures

Create test fixtures for representative workflows such as:

* straightforward assignment to resolution
* blocked and resumed workflow
* reassigned away and returned workflow
* outside-hours assignment with business-hours counting
* P1 priority using 24x7 logic
* multiple assignee transitions across one ticket

---

# 21. Acceptance Criteria

## 21.1 Core Engine

1. Given a ticket with assignment and status history, the system computes segment-level durations correctly.
2. Given a paused state, the system stops counting active handling time during that interval.
3. Given a resumed state, the system continues counting from the resumed interval.
4. Given a business-hours calendar, the system computes business-hours duration distinct from elapsed duration.
5. Given a priority override, the system applies the correct calendar or timing mode.

## 21.2 UI

1. The issue panel displays summary values and timeline explanation for a computed issue.
2. The project page displays filterable and sortable issue summaries.
3. CSV export reflects current filter state.
4. Admin users can create and update rule sets and calendars.

## 21.3 Recompute

1. Scheduled recompute updates stale issues without duplicating segments.
2. Manual rebuild updates derived data for a selected issue.
3. Recompute failures do not corrupt prior valid results.

## 21.4 Rovo Readiness

1. The backend exposes stable action endpoints that return precomputed summaries.
2. Issue explanation data is available to future Rovo actions without additional recomputation.

---

# 22. Assumptions

1. Jira issue changelog history is available and sufficient for assignment and status timeline reconstruction.
2. The customer can define which statuses and priorities map to active, paused, stopped, and priority-specific behaviors.
3. A finite set of business calendars can be defined and maintained.
4. Forge storage limits are sufficient for MVP if raw changelog payloads are not retained long term.
5. Rovo will be used only after deterministic backend actions are available.

---

# 23. Risks and Mitigations

## Risk 1

Business rules are ambiguous or inconsistent across projects.

### Mitigation

Implement explicit, versioned rule sets and require project-to-rule mapping.

## Risk 2

Changelog edge cases lead to incorrect segmentation.

### Mitigation

Build comprehensive test fixtures and issue-level audit view.

## Risk 3

Users expect Rovo to calculate SLA directly.

### Mitigation

Architect Rovo as a query surface over persisted truth, not a calculation layer.

## Risk 4

High recompute cost for large project histories.

### Mitigation

Use checkpoints, delta processing, and optional aggregate caches.

## Risk 5

Rule changes invalidate historical summaries.

### Mitigation

Version rule sets and support targeted or full rebuilds.

---

# 24. Suggested Delivery Plan

## Phase 1: Deterministic MVP

* Forge app scaffold
* Project page
* Issue panel
* Rule set and calendar entities
* Rules engine
* Scheduled recompute
* Manual issue rebuild
* Basic reporting UI

## Phase 2: Hardened Reporting

* Better admin screens
* Aggregate caches
* Project/date-range rebuilds
* Dashboard gadget
* More diagnostics and observability

## Phase 3: Rovo Surface

* Rovo agent
* Bounded actions
* Natural-language summaries and explanations using persisted results

---

# 25. Engineering Guidance for Copilot Coding Agent

## 25.1 Implementation Priorities

1. Define storage schema and types first.
2. Implement normalized event model for Jira history.
3. Implement deterministic rules engine.
4. Implement persistence of checkpoint, segments, and summary.
5. Build issue panel and project page against persisted data.
6. Add admin config screens.
7. Add rebuild workflows.
8. Add Rovo action layer last.

## 25.2 Code Structure Guidance

Suggested structure:

* `/src/domain/rules`
* `/src/domain/timeline`
* `/src/domain/summary`
* `/src/storage`
* `/src/integrations/jira`
* `/src/functions`
* `/src/ui/project-page`
* `/src/ui/issue-panel`
* `/src/ui/admin`
* `/src/rovo`
* `/tests/unit`
* `/tests/integration`
* `/tests/fixtures`

## 25.3 Coding Guidance

* Prefer pure functions for rules evaluation.
* Keep Jira integration separate from business logic.
* Use explicit TypeScript interfaces for every entity and DTO.
* Build comprehensive test fixtures before optimizing.
* Make all recompute steps idempotent.

---

# 26. Open Questions

1. Should response time and handling time always use separate rule definitions?
2. Should assignment to a team versus a named consultant be independently configurable?
3. Which Jira fields determine tracked ownership most reliably in the target environment?
4. Which statuses are canonical for paused work versus waiting for external party?
5. Will worklogs be displayed only for comparison or incorporated into any metric?
6. Is there a need for SLA warning thresholds in addition to breach thresholds?
7. Should historical summaries remain tied to old rule versions unless explicitly rebuilt?

---

# 27. Definition of Done

The MVP is done when:

* a Jira issue’s history can be converted into deterministic SLA segments
* summary metrics are persisted and displayed in the issue panel
* project-level filtered reporting works from stored summaries
* admins can configure at least one rule set and business calendar
* scheduled and manual recomputation are functional
* test fixtures validate core pause/resume/business-hours scenarios
* the backend is structured so Rovo actions can query persisted truth later

---

# 28. Appendix: Example Questions the Product Must Answer

* When did SLA start for ticket ABC-123?
* How much active time did Rishi spend on ABC-123?
* Why was ABC-123 paused from 10:00 to 15:30?
* How much counted time occurred during IST business hours?
* Which tickets breached response SLA this week?
* Which consultant accumulated the most active handling time yesterday?
* How does computed active time compare with manually entered worklogs?
