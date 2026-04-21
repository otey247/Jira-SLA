# Jira SLA Tracker Business Logic Guide

This document explains, in business terms, how Jira-SLA calculates timing, how
ownership is interpreted, and how read-only configuration affects the result.

## What the calculation reads

For each issue, the app reads:

- issue creation and update timestamps
- assignee changes
- status changes
- priority changes
- resolution changes
- configured ownership-field or responsible-organization changes
- configured team-field changes

## Core configuration objects

### Business calendar

Controls business-day slicing:

- timezone
- working days
- working hours
- holidays
- after-hours timing mode

### Field mapping

Controls which Jira fields are treated as:

- assignee
- status
- priority
- resolution
- team
- ownership / responsible organization

### Rule set

Controls how mapped fields are interpreted:

- tracked assignees
- tracked teams
- tracked ownership values
- ownership precedence
- start mode
- response start mode
- handling start mode
- enabled clocks
- breach basis
- active statuses
- paused statuses
- stopped statuses
- resume rules
- priority overrides and thresholds

## Ownership interpretation

Ownership is evaluated in configured precedence order.

Example default precedence:

1. ownership field
2. team field
3. assignee fallback

That means a ticket can start SLA because its Responsible Organization changes
to `Capgemini`, even if the assignee is still blank.

## Segment meanings

- `untracked` – pre-start or excluded queue time before ownership transfer
- `response` – SLA started, but active handling has not yet begun
- `active` – counted working time in an active status while ownership is tracked
- `paused` – owned internally, but paused by business communication/workflow
- `waiting` – not currently owned by the tracked team
- `outside-hours` – excluded calendar time for business-hours priorities
- `stopped` – resolved or terminal

## Pause and resume behavior

Paused statuses such as `Need More Info` do not automatically resume on the next
status change unless a configured resume rule matches.

Example:

- pause status: `Need More Info`
- resume rule: `Need More Info -> In Progress`

In that case, the clock remains paused through intermediate statuses such as
`Assigned` and resumes only when the issue reaches `In Progress`.

## Separate clocks and breach basis

The engine now treats response and active handling as separate configurable
clocks.

- **response start mode** controls when first-response timing begins
- **handling start mode** controls when active-handling timing begins
- **enabled clocks** determine whether a priority tracks response, active
  handling, or both
- **breach basis** determines which clock (or combined / resolution elapsed time)
  is used when deciding the SLA state

Example hybrid policy:

- response starts on ownership transfer
- handling starts on active status
- breach basis = active

That means queue time before Capgemini ownership is excluded, the response clock
can begin as soon as ownership transfers, and active handling does not start
until the issue reaches an active status such as `In Progress`.

## Derived-data integrity and reporting cache

Each recompute writes a coordinated compute run across:

- issue summary
- issue segments
- checkpoint
- aggregate cache rows

If a write is interrupted, the checkpoint and summary are marked as
`repairable`, the UI explains why, and an admin can trigger repair from the
project or issue surfaces.

Project and dashboard rollups prefer aggregate cache rows. If cache rows are not
available yet, the UI falls back to direct issue summaries and explicitly shows
that fallback so reporting behavior remains deterministic and auditable.

## Read-only behavior

The app does not mutate Jira. It reads Jira history, computes derived data, and
stores summaries/segments in Forge storage for reporting.

See also:

- [docs/customer-approval/read-only-approach.md](customer-approval/read-only-approach.md)
- [docs/customer-approval/business-logic-account-template.md](customer-approval/business-logic-account-template.md)
- [docs/customer-approval/sample-calculation-walkthrough.md](customer-approval/sample-calculation-walkthrough.md)
- [docs/customer-approval/high-level-calculation-flow.md](customer-approval/high-level-calculation-flow.md)
