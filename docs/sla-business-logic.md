# Jira SLA Tracker Business Logic Guide

This document explains, in business terms, how Jira-SLA turns Jira issue
history into SLA time. The goal is to make the calculation understandable and
auditable: what the app reads, when the SLA starts, why time is counted or not
counted, and how the final breach state is decided.

## What the app is trying to answer

For each issue, the app answers four practical questions:

1. When did SLA timing begin?
2. What kind of time was each interval: response, active, paused, waiting, or
   excluded?
3. How much counted time has accumulated under the configured calendar and
   policy?
4. Is the ticket still healthy, approaching breach, or breached?

The app does not guess from the issue's current state alone. It rebuilds the
timeline from Jira history so the result reflects how the ticket actually moved
between owners, statuses, priorities, and resolution states over time.

## What the calculation reads

For each issue, the calculation reads the issue snapshot and relevant Jira
history, including:

- issue creation and update timestamps
- assignee changes
- status changes
- priority changes
- resolution changes
- configured ownership-field or responsible-organization changes
- configured team-field changes

This means SLA is based on the full sequence of change events, not just the
latest values visible on the ticket.

## The three configuration layers

The calculation is driven by three configuration layers that answer different
questions.

### 1. Field mapping

Field mapping tells the app which Jira fields should be interpreted as:

- assignee
- status
- priority
- resolution
- team
- ownership or responsible organization

This matters because different Jira implementations use different custom fields.
Field mapping converts tenant-specific Jira data into a consistent SLA model.

### 2. Business calendar

The business calendar controls how raw elapsed time is sliced into business
time. It defines:

- timezone
- working days
- working hours
- holidays
- after-hours timing mode

If a policy uses business-hours timing, only the slices that fall inside the
calendar count toward the SLA. Time outside the calendar is still visible in the
timeline, but it is tracked as excluded time rather than counted time.

### 3. Rule set

The rule set tells the app how to interpret the mapped fields. It controls:

- tracked assignees
- tracked teams
- tracked ownership values
- ownership precedence
- start mode
- response start mode
- active start mode
- enabled clocks
- breach basis
- active statuses
- paused statuses
- stopped statuses
- resume statuses and resume rules
- priority overrides and thresholds

In business terms, the rule set answers: when the SLA should start, which work
belongs to the tracked team, which statuses count as active work, which statuses
pause the clock, and what threshold defines a breach.

## High-level calculation flow

The calculation follows a simple business flow even though the underlying event
processing is detailed.

1. Read the issue and changelog history from Jira.
2. Normalize tenant-specific fields into a standard ownership, status, priority,
   and resolution model.
3. Rebuild the issue state after each change event.
4. Decide whether SLA has started and whether ownership is currently tracked.
5. Classify each interval into a business meaning such as response, active,
   paused, waiting, or stopped.
6. Apply the business calendar or 24x7 policy to that interval.
7. Roll the segments into summary totals and determine health, warning, or
   breach.

This is why the result can explain not only the current SLA state, but also how
the issue arrived there.

## How ownership is interpreted

Ownership is one of the most important inputs because it determines whether the
issue is considered inside or outside the tracked operating model.

Ownership is evaluated in configured precedence order. A common default is:

1. ownership field
2. team field
3. assignee fallback

That means a ticket can start SLA because its Responsible Organization changes
to `Capgemini`, even if the assignee is still blank.

This precedence matters because customers often want SLA to follow business
responsibility, not only the individual assignee. In that model, an internal
handoff between two consultants can keep timing continuous, while a handoff back
to the customer or another external team can move the issue into a waiting
state.

## What causes the SLA to start

The app supports multiple start models because different service desks define
SLA start differently.

- `assignment` means the clock can start when the issue enters tracked
  ownership.
- `status` means the clock can start when the issue reaches a configured active
  status.
- `assignment-or-status` means either of those conditions can start the clock.
- `ownership-field` means a configured ownership-style field is the decisive
  trigger.

The app can apply separate start rules to the two clocks it supports:

- response clock
- active handling clock

That separation is important. Many teams want first-response timing to begin as
soon as ownership transfers, but they want active handling time to begin only
when real work starts.

Example:

- response starts on ownership transfer
- active handling starts on `In Progress`

In that model, queue time before tracked ownership is excluded, the response
clock can begin immediately after the tracked team takes responsibility, and
active work does not begin until the issue reaches an active workflow state.

## How each interval is classified

Once the app has rebuilt the issue state between two timestamps, it assigns that
interval a segment type. Each type has a specific business meaning.

### `untracked`

`untracked` means SLA has not started for that interval.

Typical reasons:

- the issue has not yet entered tracked ownership
- the start condition has not yet been met
- the issue is still in pre-SLA queue time

This is excluded from SLA totals because the tracked support process has not yet
officially begun.

### `response`

`response` means the SLA has started and the response clock is running, but
active handling has not yet started.

This usually represents the period after the issue becomes owned by the tracked
team and before it reaches the first active working status.

### `active`

`active` means counted handling time is accruing.

For an interval to be active, the issue must still be in tracked ownership and
its status must match one of the configured active statuses.

### `paused`

`paused` means the issue is still within the tracked support model, but the
clock is intentionally not accruing because the workflow indicates a business
pause.

Typical examples include waiting for customer information, formal hold states,
or statuses that the customer agreed should not count as active handling time.

### `waiting`

`waiting` means the issue left tracked ownership after SLA had already started.

This is different from `untracked`:

- `untracked` is before the SLA starts
- `waiting` is after the SLA starts, but while the issue is outside the tracked
  team's ownership

This distinction matters because it separates pre-start queue time from later
handoffs away from the service provider.

### `outside-hours`

`outside-hours` means the underlying interval exists, but a business-hours
policy excludes part of it from counted SLA time.

The issue panel can still show that time in the timeline so the result remains
auditable. It simply does not add to counted business seconds.

### `stopped`

`stopped` means the issue reached a terminal condition, usually because it is
resolved or because its status belongs to the configured stopped-status list.

Once stopped, the clock no longer accumulates additional time for that interval.

## Why pause and resume are handled carefully

Pause handling is intentionally stricter than a simple "left paused status,
therefore resume" rule.

Paused statuses such as `Need More Info` do not automatically resume on the next
status change unless the configured resume logic allows it.

Example:

- pause status: `Need More Info`
- resume rule: `Need More Info -> In Progress`

In that case:

- `Need More Info` is paused
- a move to `Assigned` can remain paused
- timing resumes only when the issue reaches `In Progress`

This protects the business interpretation. Without resume rules, teams can
appear to resume SLA too early just because the workflow briefly passed through
an administrative status on the way back to real work.

## Why intra-team reassignment does not necessarily pause SLA

Assignee changes do not automatically mean the issue has left ownership.

If the ticket remains within the tracked ownership model, a reassignment from
one internal consultant to another is treated as a continuity event, not as a
handoff out of scope. The result is:

- timing can continue without creating `waiting`
- consultant attribution can still change across segments
- the audit trail shows who owned each counted interval

This is usually what customers want, because the service provider is still
responsible even if the individual owner changes.

## Business-hours versus 24x7 timing

The app separates raw elapsed time from counted business time.

If a priority uses `business-hours` timing:

- the full interval still exists in the timeline
- only the slices inside working hours count toward response or active totals
- nights, weekends, and holidays become excluded time

If a priority uses `24x7` timing:

- the entire interval counts continuously
- no outside-hours exclusion is applied

This allows the same workflow to support different service levels. For example,
a P1 ticket can run overnight under a 24x7 override, while a lower-priority
ticket follows the business calendar.

## Separate clocks and breach basis

The engine treats response and active handling as separate configurable clocks.

- response start mode controls when first-response timing begins
- active start mode controls when active-handling timing begins
- enabled clocks determine whether a priority tracks response, active, or both
- breach basis determines which measured value is used to decide health and
  breach

The breach basis can be:

- response
- active
- combined
- resolution

That means the breach decision does not have to be tied to a single model.
Some customers care primarily about response speed, some care about active work
time, and some care about overall time from SLA start to resolution.

Example hybrid policy:

- response starts on ownership transfer
- active handling starts on active status
- both clocks are enabled
- breach basis = active

In that configuration, response time is still recorded and visible, but the
formal breach decision is based on active handling time.

## How the summary is built

After segments are calculated, the app rolls them into a summary that the issue
panel, project page, dashboard, and reporting features can reuse.

The summary includes:

- response seconds
- active seconds
- paused seconds
- waiting seconds
- outside-hours seconds
- combined seconds
- resolution seconds
- current state
- effective policy
- breach state
- per-assignee attribution
- timeline explanation

The breach state is then interpreted as:

- `healthy` when the issue is still comfortably within threshold
- `warning` when it is approaching the threshold
- `breached` when the selected breach basis has reached or exceeded the limit

This lets the UI explain not only the current number, but also which policy was
applied to produce it.

## Worked examples

### Ownership transfer to the tracked provider

- 09:00 issue created with Responsible Organization = Customer
- 10:00 Responsible Organization changes to Capgemini
- 11:00 status moves to `In Progress`

Result:

- 09:00-10:00 is `untracked`
- SLA starts at 10:00 when ownership transfers to a tracked value
- 10:00-11:00 is `response`
- 11:00 onward is `active` while ownership remains tracked and the status stays
  active

### Need More Info pause with gated resume

- 12:00 status changes from `In Progress` to `Need More Info`
- 13:00 status changes from `Need More Info` to `Assigned`
- 13:30 status changes from `Assigned` to `In Progress`

Result:

- 12:00-13:00 is `paused`
- 13:00-13:30 can remain `paused` if the configured resume rule has not matched
- timing resumes at 13:30 when the configured resume condition is satisfied

### Weekend handling for business-hours priorities

- Friday 17:00 active work starts
- Friday 18:00 business day ends
- Monday 09:00 next business day begins

Result for business-hours timing:

- Friday 17:00-18:00 counts as active business time
- Friday 18:00-Monday 09:00 is excluded from counted SLA time
- only the in-hours slice contributes to the measured business seconds

## Why the output is auditable

Each recompute stores both detailed segments and a rolled-up summary. That gives
the app two useful properties:

- the UI can explain the current SLA state in plain language
- reporting can use precomputed data instead of recalculating every view live

Each recompute writes a coordinated compute run across:

- issue summary
- issue segments
- checkpoint
- aggregate cache rows

If a write is interrupted, derived data can be marked as `repairable` so the UI
can explain that the issue needs a rebuild or repair rather than silently
showing a partial result.

Project and dashboard rollups prefer aggregate cache rows. If cache rows are not
available yet, the UI can fall back to issue summaries while still making that
fallback explicit.

## Read-only behavior

The app does not mutate Jira. It reads Jira history, computes derived data, and
stores summaries and segments in Forge storage for reporting.

This is an important part of the business reasoning: the app is designed to
observe and explain SLA behavior, not to change tickets, statuses, comments, or
workflow in Jira.

## See also

- [docs/customer-approval/read-only-approach.md](customer-approval/read-only-approach.md)
- [docs/customer-approval/business-logic-account-template.md](customer-approval/business-logic-account-template.md)
- [docs/customer-approval/sample-calculation-walkthrough.md](customer-approval/sample-calculation-walkthrough.md)
- [docs/customer-approval/high-level-calculation-flow.md](customer-approval/high-level-calculation-flow.md)
