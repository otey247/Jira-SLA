# Jira SLA Tracker Business Logic Guide

This document explains, in business terms, how Jira SLA Tracker calculates SLA
time, what counts toward a breach, and why the tool may classify time
differently across issues.

It is written for clients, delivery leads, support managers, and Jira admins
who want to understand how the tool behaves before or after rollout.

## Purpose of the calculation

The app does not simply read the current issue status and guess an SLA. It
reconstructs the issue timeline from Jira history, then classifies each period
of time into one of several SLA states.

That means the tool is designed to answer questions like:

- When did the SLA start?
- How much time counted as response time?
- How much time counted as active handling time?
- How much time was paused?
- How much time fell outside business hours?
- Did the issue breach its target for its priority?

## What data the app uses

For each issue, the app reads the Jira issue record and its changelog history.
It uses these fields as the inputs to SLA calculation:

- issue created timestamp
- assignee changes
- status changes
- priority changes
- resolution set or cleared

The app then converts those Jira events into a chronological event stream and
rebuilds the issue state over time.

## Core configuration that controls the SLA

The calculation depends on two client-managed configuration objects.

### 1. Business calendar

The business calendar defines when business time is allowed to accrue.

It includes:

- timezone
- working days
- working hours start and end
- holiday dates
- after-hours mode

If a rule uses business-hours timing, only time inside this calendar counts
toward response or active handling.

### 2. Rule set

The rule set defines which issues are tracked and how issue states are
classified.

It includes:

- project keys to track
- tracked assignees or teams
- SLA start mode
- active statuses
- paused statuses
- stopped statuses
- business calendar to use
- priority-specific SLA targets
- priority-specific timing mode overrides

## High-level calculation flow

For each issue, the app follows this sequence:

1. Read the issue and Jira changelog history.
2. Rebuild the issue state in timestamp order.
3. Decide when the SLA starts.
4. Split the timeline into segments between one event and the next.
5. Classify each segment as response, active, paused, waiting, outside-hours,
   or stopped.
6. Apply business-hours rules or 24x7 rules to determine how much of each
   segment counts.
7. Roll the segments up into a summary for reporting, dashboards, and the issue
   panel.

## When the SLA starts

The SLA does not always start at issue creation. It starts based on the rule
set's `startMode`.

### Start mode: `assignment`

The SLA starts when the issue first becomes owned by a tracked assignee or
tracked team.

This is useful when time should only begin once the work has reached the
service team.

### Start mode: `status`

The SLA starts when the issue first enters a configured active status.

This is useful when the workflow status is the primary indicator that work has
officially begun.

## How ownership is interpreted

Ownership matters because the app distinguishes between work that is with the
tracked team and work that is not.

In the deployed Jira sync path, ownership is treated like this:

- if an issue is assigned to one of the tracked assignee account IDs, it is
  treated as owned by the tracked team
- if no tracked assignees and no team IDs are configured, any non-empty
  assignee is treated as owned
- if the issue is unassigned, it is not treated as owned

This affects whether time is counted as active work, waiting time, or paused
time.

## Segment types and what they mean

Every interval between one event and the next is classified into one segment
type.

### `response`

Response time is the initial SLA window after the SLA has started but before
the issue has moved into a counted active-working state.

In practical terms, this measures the time it took for the tracked team to pick
up and meaningfully engage the issue after SLA start.

### `active`

Active time is the counted handling time while the issue is in a configured
active status and is owned by the tracked team.

This is the primary duration used for breach calculations in the deployed Jira
sync engine.

### `paused`

Paused time is time when the SLA has started, but the issue is in a configured
paused status.

Typical examples include:

- waiting for customer
- on hold
- pending third party

Paused time is stored and reported separately so clients can see that elapsed
time existed without charging it to the service team.

### `waiting`

Waiting time is time after SLA start when the issue is not currently owned by
the tracked team or tracked assignee.

This distinguishes "not with the service team" from "with the service team but
intentionally paused by workflow."

### `outside-hours`

Outside-hours time is time that falls outside the configured business calendar.

If the priority is using business-hours timing, this time does not count toward
response or active handling, but it is still reported so clients can explain
why elapsed clock time and counted SLA time differ.

### `stopped`

Stopped time begins once the issue is resolved or reaches a configured stopped
status.

At that point, no further SLA time is accrued.

## How business hours are applied

For response and active segments, the app checks the priority timing mode.

### Timing mode: `business-hours`

The app splits the interval by calendar boundaries and only counts time that
falls within:

- a configured working day
- the configured working hours
- a non-holiday date

Time outside that window becomes `outside-hours`.

### Timing mode: `24x7`

The full elapsed interval counts, regardless of calendar, holidays, or local
working hours.

This is typically used for higher priorities or always-on support commitments.

## How priorities affect the SLA

The rule set can define per-priority overrides.

For each priority, the app can store:

- timing mode: `business-hours` or `24x7`
- SLA target in minutes

This means two issues can follow the same workflow but still accrue SLA time
differently if their priorities have different timing rules or targets.

Example:

- a `High` issue may count 24x7 and breach after 60 minutes
- a `Medium` issue may count only business hours and breach after 240 minutes

## How breach is calculated

In the deployed Jira sync engine, breach is based on counted active handling
time, not total elapsed time.

The app:

1. looks up the current issue priority
2. finds the configured target for that priority
3. totals counted `active` business seconds
4. converts that total to minutes
5. marks the issue as breached if active time is greater than the configured
   target

This is important because:

- paused time does not cause a breach
- waiting time does not cause a breach
- outside-hours time does not cause a breach when the timing mode is
  business-hours
- response time is reported separately from active handling time

## How current SLA state is determined

The app also assigns a current SLA state for reporting.

The main outcomes are:

- `active`: the issue is currently accruing counted time
- `paused`: the issue is waiting to start or is in a paused condition
- `breached`: the issue is still open and has exceeded its target
- `met`: the issue has stopped and did not breach before stopping

This lets dashboards distinguish between issues that are still in progress and
issues that completed successfully.

## Why total elapsed time may not match SLA time

Clients often compare wall-clock elapsed time with SLA totals and expect them
to match. They usually should not.

They differ because the app separates:

- response time
- active handling time
- paused time
- waiting time
- outside-hours time
- stopped time

An issue may be open for three calendar days but only accrue four business
hours of active SLA time if most of that period was outside hours, waiting for
ownership, or in a paused status.

## How the app handles calendar edge cases

The business-hours logic is timezone-aware and recalculates offsets by date.
This matters for:

- daylight saving time changes
- regional calendars
- holidays
- issues that span multiple business days

The app splits intervals at day boundaries and working-hour boundaries so the
counted time remains aligned with the client's local business calendar.

## How the app explains results to users

The UI and reporting use precomputed summaries and segments.

That means users can see:

- the current SLA state on an issue
- response, active, paused, and outside-hours totals
- a segment-by-segment timeline explanation
- assignee totals
- team totals
- breach counts and rollups on dashboards

## Practical examples

### Example 1: Started but not yet actively worked

Scenario:

- Issue is created at 9:00 AM.
- It is assigned to the tracked team at 9:15 AM.
- It remains in a non-paused, non-stopped state until 10:00 AM.

Result:

- SLA starts at 9:15 AM.
- The time after start may be classified as `response` until the first counted
  active-working state is reached.

### Example 2: Active work during business hours

Scenario:

- Issue is owned by the tracked team.
- Status is one of the configured active statuses.
- The interval is inside business hours.

Result:

- The interval is counted as `active`.
- Business seconds accrue toward the breach threshold.

### Example 3: Work continues after hours

Scenario:

- Issue remains active from 4:30 PM to 6:30 PM.
- Business hours end at 5:00 PM.
- Timing mode is business-hours.

Result:

- 4:30 PM to 5:00 PM counts as `active`
- 5:00 PM to 6:30 PM is stored as `outside-hours`
- only the first 30 minutes count toward SLA

### Example 4: Waiting on customer

Scenario:

- Issue is moved to a paused status such as `Waiting for customer`.

Result:

- The time is stored as `paused`
- it remains visible in reporting
- it does not increase counted active SLA time

### Example 5: Resolved issue

Scenario:

- Issue is resolved or moved to a configured stopped status.

Result:

- SLA stops
- the final state becomes `met` or `breached` depending on whether the counted
  active time exceeded the configured target before stop

## Important implementation notes for clients

- SLA accuracy depends on Jira changelog quality. If assignment, status,
  priority, or resolution changes are missing from Jira history, the SLA result
  will reflect the available history.
- Status mapping is client-controlled. A status only behaves as active, paused,
  or stopped if the rule set explicitly says so.
- Priority behavior is client-controlled. Different priorities can use
  different timing modes and targets.
- The current deployed Jira sync engine uses active handling time as the breach
  basis.
- The app stores both detailed segments and rolled-up summaries, so individual
  issue explanations and dashboard totals come from the same underlying logic.

## Recommended client decisions during onboarding

To avoid confusion later, clients should align on these decisions before going
live:

- Which workflow statuses mean work is actively being handled?
- Which statuses should pause the SLA?
- Which statuses should stop the SLA?
- Should SLA start on assignment or on status entry?
- Which assignees or teams count as tracked ownership?
- Which priorities run in business-hours mode versus 24x7?
- What are the active-time targets for each priority?
- Which timezone and holiday calendar should apply?

## Related documents

- [Installation guide](installation-guide.md)
- [Customer installation guide](customer-installation-guide.md)
