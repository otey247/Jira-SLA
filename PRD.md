# Jira SLA Application Delivery Checklist

This checklist replaces the narrative PRD with a build-focused view of the Jira
SLA application requirements and delivery status.

## Product outcome

- [x] Compute deterministic SLA and active handling time from Jira issue history
- [x] Persist precomputed summaries and timeline segments for reuse across UI and Rovo
- [x] Explain computed SLA results through an auditable issue timeline
- [x] Support configurable calendars, ownership rules, priority overrides, and rebuild workflows

## Core SLA engine

- [x] Start SLA when tracked assignment or status conditions are met
- [x] Pause SLA when tickets enter paused states or leave tracked ownership
- [x] Resume SLA when tracked ownership and active conditions return
- [x] Support multiple pause and resume cycles per issue
- [x] Split intervals into response, active, paused, waiting, stopped, and outside-hours segments
- [x] Compute business-hours and 24x7 timing behavior
- [x] Apply priority-specific breach thresholds and timing modes
- [x] Persist segment source references and rule-set version metadata
- [x] Persist issue-level rollups including response, active, paused, outside-hours, breach, assignee, team, and status state

## Jira integration

- [x] Retrieve Jira issue metadata
- [x] Retrieve Jira changelog history
- [x] Retrieve Jira worklogs for audit comparison views
- [x] Support project-scoped issue search for background and manual rebuilds

## Backend functions

- [x] `syncIssueHistory(issueKey, ruleSetId)`
- [x] `recomputeIssueSla(issueKey, ruleSetId?)`
- [x] `recomputeProjectWindow(projectKey, dateRange, ruleSetId?)`
- [x] `getIssueSummary(issueKey)`
- [x] `getIssueTimeline(issueKey)`
- [x] `getIssueAudit(issueKey)`
- [x] `searchIssueSummaries(filters)`
- [x] `saveRuleSet(ruleSetPayload)`
- [x] `saveBusinessCalendar(calendarPayload)`
- [x] `automationRecompute(payload)`
- [x] `rovoGetIssueSummary(issueKey)`
- [x] `rovoExplainIssue(issueKey)`
- [x] `rovoListBreaches(filters)`
- [x] `rovoGetAssigneeMetrics(projectKey)`

## Recalculation and operations

- [x] Scheduled background recomputation for recently updated issues
- [x] Manual issue rebuild from the issue panel and project page
- [x] Manual project and date-window rebuild from the project page
- [x] Idempotent recomputation that only writes derived data after successful computation
- [x] Rebuild job history with status, processed counts, error counts, and diagnostic messages

## Project page UX

- [x] KPI summary section
- [x] Filters for assignee, team, priority, breach state, status, and recompute date range
- [x] Sortable issue results table
- [x] Drill-down audit panel for the selected issue
- [x] CSV export for the filtered result set
- [x] Issue explorer with audit explanation and worklog comparison
- [x] Assignee analytics view
- [x] Rule set management view
- [x] Calendar management view
- [x] Rebuild jobs and diagnostics view

## Issue panel UX

- [x] Display SLA start time
- [x] Display response, active, paused, outside-hours, priority, status, and assignee metrics
- [x] Display current clock state and breach status
- [x] Display the timeline of segments
- [x] Display human-readable pause and resume explanations
- [x] Allow manual rebuild / refresh

## Dashboard gadget UX

- [x] Show KPI cards for issue count, breaches, average response, and average active time
- [x] Show breach count by priority
- [x] Show average active time by team
- [x] Show average response time by assignee
- [x] Show a recent breach trend view

## Administration

- [x] Create and edit business calendars
- [x] Create, edit, and delete rule sets
- [x] Map projects to rule sets through rule-set project assignments
- [x] Validate admin payloads for required names, timezones, project key format, and working hours

## Explainability and auditability

- [x] Surface exact timestamps for SLA start and segment transitions
- [x] Provide human-readable explanation lines for response, active, paused, waiting, stopped, and outside-hours decisions
- [x] Expose worklogs alongside computed timelines for comparison

## Reporting

- [x] Filter summaries by project, assignee, team, priority, current status, breach state, and recompute date range
- [x] Sort results by issue key, response time, active time, paused time, breach state, priority, status, and recompute timestamp
- [x] Aggregate metrics for KPI cards, assignee views, team views, and gadget visualizations
- [x] Export filtered issue-level reports to CSV

## Security and data handling

- [x] Use Jira issue history as the source of truth and serve query functions from persisted derived data
- [x] Store account identifiers needed for reporting without persisting unnecessary personal profile data
- [x] Keep Rovo actions bounded to precomputed summaries instead of raw Jira history

## Testing and validation

- [x] Unit tests for calendar splitting and business-hours logic
- [x] Unit tests for SLA engine pause, resume, breach, waiting, and outside-hours behavior
- [x] Integration tests for Jira changelog pagination handling
- [x] Reporting tests for filters, assignee rollups, and explanation generation
- [x] Root validation commands: `npm run build`, `npm test -- --runInBand`, `npm run lint`

## Future / explicitly deferred items

- [ ] Marketplace publication
- [ ] External warehouse synchronization
- [ ] Full no-code rule builder with arbitrary expression language
- [ ] Predictive SLA breach forecasting
- [ ] Auto-remediation or Jira workflow mutation
- [ ] Saved reports or scheduled email summaries

## Definition of done

- [x] Jira issue history is converted into deterministic SLA segments
- [x] Summary metrics are persisted and displayed in the issue panel
- [x] Project-level filtered reporting works from stored summaries
- [x] Admins can configure at least one rule set and business calendar
- [x] Scheduled and manual recomputation are functional
- [x] Test fixtures validate core pause, resume, business-hours, and reporting scenarios
- [x] Rovo actions query persisted SLA truth without triggering recomputation
