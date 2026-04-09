Here is the concrete build blueprint I would use.

## Recommended app shape

Build one Forge app with five primary surfaces:

1. **`jira:projectPage`** as the main reporting app
2. **`jira:issuePanel`** for per-ticket SLA explanation
3. **`jira:dashboardGadget`** for summarized charts
4. **`scheduledTrigger`** plus later **Atlassian app triggers / automation actions** for recompute
5. **`rovo:agent` + `action` modules** to expose the computed data conversationally

Forge supports Jira project pages, issue panels, dashboard gadgets, scheduled triggers, app triggers, automation actions, and Rovo modules, so this can stay fully Atlassian-native. ([Atlassian Developer][1])

## The architecture I would implement

Use a simple split:

* **Frontend:** Custom UI React app for project page, issue panel, and gadget
* **Backend:** Forge functions for sync, recompute, reporting, admin, and Rovo actions
* **Data:** Jira changelog + worklog APIs as inputs, Custom Entity Store as computed persistence
* **AI surface:** Rovo calls backend actions against precomputed summaries, not raw Jira history

Forge is built for manifests, functions, UI, storage, and APIs without you running your own app server, and Atlassian’s storage guidance recommends `@forge/kvs` for new apps, including Custom Entity Store. ([Atlassian Developer][2])

## Core modules to define first

I would start with this module set in `manifest.yml`:

* `jira:projectPage`
* `jira:issuePanel`
* `jira:dashboardGadget`
* `scheduledTrigger`
* `function`
* `action` for Automation
* `rovo:agent`
* `action` for Rovo

That gives you a real app surface, a per-issue explainability surface, a reporting surface, a background recalculation path, and an AI path. The project page can live in Jira and Jira Service Management; the issue panel is shown on the issue view; the dashboard gadget appears on Jira dashboards; the scheduled trigger can run every 5 minutes, hourly, daily, or weekly; and Rovo agents/actions are explicitly backed by Forge functions. ([Atlassian Developer][1])

## Storage schema

Use Custom Entity Store for structured, queryable app data. Define these entities:

### `rule_set`

Stores the business rules per customer or project:

* `ruleSetId`
* `name`
* `projectKeys`
* `teamIds`
* `startMode` such as `assignment` or `status`
* `activeStatuses`
* `pausedStatuses`
* `stoppedStatuses`
* `resumeRules`
* `businessCalendarId`
* `timezone`
* `priorityOverrides`
* `version`

### `business_calendar`

* `calendarId`
* `timezone`
* `workingDays`
* `workingHours`
* `holidayDates`
* `afterHoursMode`
* `priorityMode` such as `business-hours` or `24x7`

### `issue_checkpoint`

Tracks incremental processing:

* `issueKey`
* `ruleSetId`
* `lastProcessedChangelogId`
* `lastProcessedAt`
* `lastIssueUpdated`
* `summaryVersion`
* `needsRebuild`

### `issue_segment`

One row per calculated segment:

* `segmentId`
* `issueKey`
* `ruleSetId`
* `assigneeAccountId`
* `teamLabel`
* `status`
* `priority`
* `segmentType` such as `response`, `active`, `paused`, `waiting`, `outside-hours`
* `startedAt`
* `endedAt`
* `rawSeconds`
* `businessSeconds`
* `sourceEventStart`
* `sourceEventEnd`

### `issue_summary`

Precomputed totals:

* `issueKey`
* `ruleSetId`
* `currentState`
* `responseSeconds`
* `activeSeconds`
* `pausedSeconds`
* `outsideHoursSeconds`
* `breachState`
* `currentAssignee`
* `currentPriority`
* `lastRecomputedAt`

### `aggregate_daily`

Optional reporting cache:

* `date`
* `projectKey`
* `assigneeAccountId`
* `teamLabel`
* `priority`
* `ticketCount`
* `avgResponseSeconds`
* `avgActiveSeconds`
* `breachCount`

Custom Entity Store supports custom entities with typed attributes and indexes for query patterns, which is exactly what this reporting model needs. Atlassian also recommends avoiding unbounded entity growth, so I would keep raw history out of storage and persist only checkpoints, computed segments, summaries, and aggregates. ([Atlassian Developer][3])

## Input data sources from Jira

Use Jira as the source of truth for:

* issue metadata
* changelog history
* worklogs

The changelog is what you need for assignee transitions, status changes, priority changes, and resolution timing. Worklogs are still useful as a comparison layer or audit aid, but not as the primary SLA authority for this use case. Jira Cloud’s REST APIs expose issues and worklogs, and the issue resources are the right starting point for history-driven calculation. ([Atlassian Developer][4])

## Recompute algorithm

This is the deterministic engine.

### Step 1: fetch and normalize issue history

For a given issue:

* load the current issue
* fetch changelog entries after `lastProcessedChangelogId`
* fetch worklogs if you want an audit comparison
* normalize all relevant events into one ordered timeline:

  * issue created
  * assignee changed
  * status changed
  * priority changed
  * resolution set / cleared

Jira’s issue APIs and changelog-capable issue resources provide the timeline inputs, and worklog APIs provide the manual logging stream for optional variance checks. ([Atlassian Developer][4])

### Step 2: determine state at each interval boundary

At each event boundary, compute:

* is this issue assigned to the tracked team or consultant?
* is the status active, paused, or stopped?
* which priority rule applies?
* which business calendar applies?
* is the current timestamp inside business hours?

### Step 3: emit segments

Split whenever any of these change:

* assignee
* status
* priority
* ownership in/out of tracked team
* business-hours open/close boundary
* stop condition

For each segment, compute:

* raw duration
* business-hours duration
* segment type

### Step 4: roll up summary

Aggregate segments into:

* response time
* cumulative active handling time
* cumulative paused time
* per-assignee totals
* per-team totals
* breach / warning status

### Step 5: persist atomically

Write the updated checkpoint, segments, and summary in one transaction when possible. Forge supports Custom Entity Store transactions for grouped operations that must succeed or fail together. ([Atlassian Developer][5])

## Trigger model

### MVP

Use:

* **scheduled trigger every 5 minutes**
* **manual “rebuild this issue” button in UI**

Forge scheduled triggers support 5-minute, hourly, daily, and weekly intervals, run without user context, and do not retry automatically on errors. That makes them good for a reliable polling MVP as long as you design for idempotency. ([Atlassian Developer][6])

### Production

Then add:

* **Atlassian app triggers** for issue updated / related Jira events
* **custom Automation action** so admins can trigger recalculation or backfill through Jira Automation rules

Forge supports app triggers for Atlassian events and custom automation actions that users can select and configure in automation rules. ([Atlassian Developer][7])

## Frontend screens

### 1) Project page

Make this the main app tab.

Tabs:

* Overview
* Issue Explorer
* Assignee Analytics
* Rule Sets
* Calendars
* Rebuild Jobs
* Audit

Primary content:

* KPI strip: avg response, avg active, paused total, breach count
* filters: project, queue, assignee, team, priority, date range, breach state
* issue table with sortable columns
* drill-in drawer with timeline and explanation
* export CSV

`jira:projectPage` supports top-level placement in project navigation, including Jira Service Management projects. ([Atlassian Developer][1])

### 2) Issue panel

Put the per-ticket explanation here.

Show:

* SLA start time
* current clock state
* total active time
* total paused time
* current owner
* current priority
* breach status
* timeline of all segments
* plain-English explanation of why the timer paused or resumed

`jira:issuePanel` is meant to add custom content to the Jira issue view, which fits this audit/explainability need well. ([Atlassian Developer][8])

### 3) Dashboard gadget

Show:

* breached tickets by priority
* average response time by consultant
* average handling time by team
* 7-day trend
* distribution of paused vs active time

The Jira dashboard gadget module is intended exactly for dashboard-level visualization. ([Atlassian Developer][9])

## Rovo design

Rovo should only call stable, precomputed actions.

Create one `rovo:agent` with actions like:

* `get_issue_sla_summary(issueKey)`
* `explain_issue_timeline(issueKey)`
* `list_breached_issues(filters)`
* `get_assignee_metrics(dateRange, assignee)`
* `compare_logged_vs_computed(issueKey)`

Rovo agents are defined with prompts and actions, and actions are implemented as Forge functions with names and descriptions that help the agent choose when to invoke them. That means the action boundary is where you control determinism. ([Atlassian Developer][10])

### Good use of Rovo here

* “Why is this ticket paused?”
* “Show me all breaches for P1 tickets this week”
* “How much active handling time did Rishi accumulate yesterday?”
* “Summarize the timeline for ABC-123”

### Bad use of Rovo here

* asking it to derive the SLA directly from raw changelog text every time
* asking it to infer business-hour math without your backend
* asking it to guess which statuses mean pause vs active

## Suggested function map

Backend functions I would create first:

* `syncIssueHistory`

  * fetches Jira issue + changelog delta + worklogs
* `recomputeIssueSla`

  * converts events into segments and summary
* `recomputeProjectWindow`

  * batch job for date ranges or projects
* `getIssueSummary`

  * UI and Rovo read path
* `getIssueTimeline`

  * UI and Rovo read path
* `searchIssueSummaries`

  * filtered project page and dashboard data
* `saveRuleSet`

  * admin UI
* `saveBusinessCalendar`

  * admin UI
* `markIssueForRebuild`

  * manual repair path
* `automationRecompute`

  * callable from Jira Automation
* `rovoGetIssueSummary`
* `rovoExplainIssue`
* `rovoListBreaches`

## Minimal manifest structure

Not full syntax, but the structure should look like this:

```yaml
modules:
  jira:projectPage:
    - key: sla-reporting-page
      resource: main
      resolver:
        function: ui-resolver
      title: SLA Analytics

  jira:issuePanel:
    - key: sla-issue-panel
      resource: issue-panel
      resolver:
        function: ui-resolver
      title: SLA Breakdown

  jira:dashboardGadget:
    - key: sla-dashboard-gadget
      resource: gadget
      resolver:
        function: ui-resolver
      title: SLA Metrics

  scheduledTrigger:
    - key: sla-sync-trigger
      function: scheduled-sync
      interval: fiveMinute

  action:
    - key: automation-recompute
      function: automation-recompute-fn
      title: Recompute SLA Summary

  rovo:agent:
    - key: sla-agent
      name: SLA Analyst
      prompt: resource:agent-prompt
      actions:
        - rovo-get-issue-summary
        - rovo-explain-issue
        - rovo-list-breaches

  action:
    - key: rovo-get-issue-summary
      function: rovo-get-issue-summary-fn
      title: Get issue SLA summary

    - key: rovo-explain-issue
      function: rovo-explain-issue-fn
      title: Explain issue SLA timeline

    - key: rovo-list-breaches
      function: rovo-list-breaches-fn
      title: List breached issues

  function:
    - key: ui-resolver
      handler: src/index.uiResolver
    - key: scheduled-sync
      handler: src/index.scheduledSync
    - key: automation-recompute-fn
      handler: src/index.automationRecompute
    - key: rovo-get-issue-summary-fn
      handler: src/index.rovoGetIssueSummary
    - key: rovo-explain-issue-fn
      handler: src/index.rovoExplainIssue
    - key: rovo-list-breaches-fn
      handler: src/index.rovoListBreaches
```

This module mix lines up directly with the current Forge module model for Jira pages, issue panels, gadgets, scheduled triggers, automation actions, and Rovo agents/actions. ([Atlassian Developer][1])

## Implementation order

### Sprint 1

* scaffold Forge app
* add `jira:projectPage`
* add Custom Entity Store entities
* build `rule_set` and `business_calendar` admin forms
* build `syncIssueHistory` and `recomputeIssueSla`
* support one project and one ruleset only

### Sprint 2

* add `jira:issuePanel`
* render summary + timeline
* add “rebuild this issue” button
* add scheduled trigger polling every 5 minutes
* add checkpointing and idempotency

### Sprint 3

* add project page analytics and filtering
* add dashboard gadget
* add CSV export
* add assignee/team rollups

### Sprint 4

* add Jira Automation action
* add event-driven update paths
* add Rovo agent and the first two actions
* harden audit / explanation text

This sequence uses the Forge primitives in the safest order: pages and storage first, scheduled background computation next, then automation and Rovo once the data model is stable. ([Atlassian Developer][11])

## What I would decide up front

Before coding, lock these business rules:

* Which assignments start the SLA: any Capgemini user, specific group, or role map?
* Which statuses are active, paused, and stopped?
* Does “assigned but not in progress” count as response SLA, handling SLA, or both?
* Which priorities use business hours versus 24x7?
* What timezone and calendar applies?
* Is the clock tied to assignee, team, or both?
* What should happen if work returns to the same assignee multiple times?

Those choices directly control the rules engine and the entity model.

## My strongest recommendation

Build the deterministic engine first and treat the custom UI and Rovo as consumers of that engine. If you reverse that and start with Rovo, you will get a demo faster but a system that is hard to trust. The Forge platform clearly supports the pieces you need for an app-first design, and Jira’s APIs give you the underlying issue and worklog data needed to make the SLA logic authoritative. ([Atlassian Developer][2])

Next, I can draft the actual **entity schema and TypeScript interfaces**, plus the **event-to-segment pseudocode** for `recomputeIssueSla`.

[1]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-project-page/?utm_source=chatgpt.com "Jira project page - Custom Project Navigation Module"
[2]: https://developer.atlassian.com/platform/forge/llms.txt "developer.atlassian.com"
[3]: https://developer.atlassian.com/platform/forge/storage-reference/storage-api-custom-entities/?utm_source=chatgpt.com "Custom Entity Store - Forge"
[4]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ "The Jira Cloud platform REST API"
[5]: https://developer.atlassian.com/platform/forge/storage-reference/transactions-entities/?utm_source=chatgpt.com "Executing Custom Entity Store transactions"
[6]: https://developer.atlassian.com/platform/forge/add-scheduled-trigger/ "Extending your app with a scheduled trigger"
[7]: https://developer.atlassian.com/platform/forge/building-automations/ "Building automations with Forge"
[8]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/?utm_source=chatgpt.com "Jira issue panel - Forge"
[9]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-dashboard-gadget/?utm_source=chatgpt.com "Jira dashboard gadget"
[10]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/?utm_source=chatgpt.com "Rovo Agent"
[11]: https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/?utm_source=chatgpt.com "Storage - Forge"
