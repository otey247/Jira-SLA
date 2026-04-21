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

## Included vs excluded time

### Included

- ownership-tracked response time
- ownership-tracked active handling time

### Excluded

- pre-ownership queue time
- waiting time while ownership is external
- paused time while customer input is pending
- outside-hours time for business-hours priorities

## Customer example scenarios

- Ownership transfer to service team:
- Consultant reassignment within service team:
- Need More Info pause and resume:
- Weekend / holiday handling:
- P1 24x7 example:

## Sign-off

- Customer approver:
- Delivery approver:
- Jira admin approver:
