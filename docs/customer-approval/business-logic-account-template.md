# Customer Business Logic Approval Template

## Account information

- Customer name:
- Jira site:
- Approval owner:
- Review date:

## Read-only assurance

- Jira data read by the app:
- Data stored in Forge storage:
- Confirmation that the app does not write Jira fields, statuses, comments, or worklogs:

## Field mapping

- Assignee field:
- Status field:
- Priority field:
- Resolution field:
- Team field:
- Ownership / responsible organization field:
- Any special custom fields:

## Ownership rules

- Tracked team values:
- Tracked ownership values:
- Ownership precedence order (`ownership`, `team`, `assignee`):
- SLA start mode:
- Response start mode:
- Active handling start mode:
- Enabled clocks (`response`, `active`, or both):
- Breach basis (`response`, `active`, `combined`, `resolution`):
- What is excluded before ownership transfer:

## Pause and resume rules

- Active statuses:
- Paused statuses:
- Stopped statuses:
- Resume rules:
- Explicit business-communication pause statuses (for example `Need More Info`):

## Timing policy

- Business calendar:
- Working days:
- Working hours:
- Holidays:
- Priorities using business-hours timing:
- Priorities using 24x7 timing:
- Response target:
- Active handling target:
- Combined target, if used:
- Resolution target, if used:

## Included vs excluded time

### Included

- ownership-tracked response time
- ownership-tracked active handling time

### Excluded

- pre-ownership queue time
- waiting time while ownership is external
- paused time while customer input is pending
- outside-hours time for business-hours priorities

## Expected segment meanings

- `untracked` means SLA has not started yet.
- `response` means the response clock is running before active work begins.
- `active` means counted handling time is accruing.
- `paused` means the issue is still in scope, but timing is intentionally stopped.
- `waiting` means SLA already started, but ownership moved outside the tracked provider.
- `outside-hours` means elapsed time existed, but the calendar excluded it from counted business time.
- `stopped` means the issue reached a terminal or resolved condition.

## Customer example scenarios

- Ownership transfer to service team:
- Consultant reassignment within service team:
- Need More Info pause and resume:
- Weekend / holiday handling:
- P1 24x7 example:

## Review questions

- Does the ownership precedence match how the customer wants responsibility to be interpreted?
- Are pause statuses and resume rules strict enough to prevent timing from resuming too early?
- Do the selected breach basis and thresholds match the contractual SLA being measured?
- Are business-hours and 24x7 priorities separated correctly?

## Sign-off

- Customer approver:
- Delivery approver:
- Jira admin approver:
