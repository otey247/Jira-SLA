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

## Read-only behavior

The app does not mutate Jira. It reads Jira history, computes derived data, and
stores summaries/segments in Forge storage for reporting.

See also:

- [docs/customer-approval/read-only-approach.md](customer-approval/read-only-approach.md)
- [docs/customer-approval/business-logic-account-template.md](customer-approval/business-logic-account-template.md)
- [docs/customer-approval/sample-calculation-walkthrough.md](customer-approval/sample-calculation-walkthrough.md)
- [docs/customer-approval/high-level-calculation-flow.md](customer-approval/high-level-calculation-flow.md)
