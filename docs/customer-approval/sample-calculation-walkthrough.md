# Sample SLA Calculation Walkthroughs

## 1. Responsible organization transfer to Capgemini

- 09:00 issue created with Responsible Organization = Customer
- 10:00 Responsible Organization changes to Capgemini
- 11:00 status moves to In Progress

Result:

- 09:00-10:00 is stored as `untracked` and excluded from SLA
- SLA starts at 10:00 when ownership transfers to a tracked value
- 10:00-11:00 counts as `response`
- 11:00 onward counts as `active` while ownership stays tracked and status is active

## 2. Consultant reassignment inside Capgemini

- 10:00 issue is owned by Capgemini and assigned to Alice
- 11:30 assignee changes from Alice to Robert
- 13:00 assignee changes from Robert back to Alice

Result:

- team ownership remains continuous while Capgemini stays the owner
- no waiting interval is introduced purely because of intra-team reassignment
- consultant attribution splits across Alice, Robert, then Alice again

## 3. Need More Info pause

- 12:00 status changes from In Progress to Need More Info
- 13:00 status changes from Need More Info to Assigned
- 13:30 status changes from Assigned to In Progress

Result:

- 12:00-13:00 is `paused` because the issue is in a configured communication pause status
- 13:00-13:30 remains `paused` because the configured resume rule has not matched yet
- timing resumes at 13:30 when the `Need More Info -> In Progress` rule matches

## 4. Weekend and holiday handling

- Friday 17:00 active work starts
- Friday 18:00 business day ends
- Monday 09:00 next business day begins

Result for business-hours priorities:

- Friday 17:00-18:00 counts as active business time
- Friday 18:00-Monday 09:00 is reported as `outside-hours`
- only business-time slices count toward breach calculations

## 5. P1 24x7 timing

- 22:00 P1 issue enters active handling
- 04:00 issue resolves overnight

Result:

- full overnight interval counts
- no outside-hours exclusion is applied
- response and active time accrue continuously because the priority override uses `24x7`
