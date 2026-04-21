# High-Level Calculation Flow

```text
Jira issue + changelog
        |
        v
Field mapping resolution
        |
        v
Normalized event stream
(assignee, team, ownership, status, priority, resolution)
        |
        v
Ownership evaluation
(precedence: ownership -> team -> assignee)
        |
        v
Start / pause / waiting / resume / stop state machine
        |
        v
Business-hours or 24x7 slicing
        |
        v
Persisted segments + summary
        |
        v
Issue panel / project page / dashboard / Rovo
```

## Plain-language explanation

1. The app reads Jira issue history.
2. It maps customer-specific Jira fields into a consistent ownership model.
3. It decides when the SLA starts.
4. It classifies each interval as response, active, paused, waiting,
   outside-hours, stopped, or untracked.
5. It applies the customer calendar and priority timing policy.
6. It stores the result and serves explanations from derived data.
