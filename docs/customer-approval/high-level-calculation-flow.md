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
3. It rebuilds the issue state after each relevant change.
4. It decides whether SLA has started and whether the issue is currently in
         tracked ownership.
5. It classifies each interval as `untracked`, `response`, `active`, `paused`,
         `waiting`, `outside-hours`, or `stopped`.
6. It applies the customer calendar or a 24x7 priority override to determine
         how much of that interval counts toward SLA.
7. It stores both detailed segments and a rolled-up summary so dashboards and
         issue views can explain the result.

## Why each stage exists

- Field mapping exists so customer-specific Jira fields can be interpreted in a
        consistent SLA model.
- Ownership evaluation exists so the app can distinguish between work that is
        still with the tracked service provider and work that has moved outside that
        ownership scope.
- The state machine exists so the app can distinguish business meanings such as
        active handling, intentional pause, waiting for external ownership, and stop.
- Calendar slicing exists so a policy can count only business time for some
        priorities while still allowing 24x7 timing for others.
- Persisted segments and summaries exist so the result is auditable rather than
        being a black-box number.

## Key business distinction

The most important distinction for customers is that the app separates:

- time before SLA starts (`untracked`)
- time after SLA starts but outside tracked ownership (`waiting`)
- time inside tracked ownership that is intentionally paused (`paused`)
- time that is eligible to count toward response or active handling

That separation is what makes the SLA output explainable during customer review.
