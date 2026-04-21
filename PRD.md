# Jira SLA Implementation Status Matrix

This matrix replaces the previous all-green checklist with a more realistic
view of what is implemented, partially implemented, planned, or deferred.

## Status legend

- **Implemented** – shipped in the repository and covered by existing flows
- **Partial** – present in the codebase, but with scoped or simplified behavior
- **Planned** – tracked in the backlog but not yet implemented end-to-end
- **Deferred** – intentionally not part of the near-term scope

## Milestone 1 – Customer correctness foundation

| Area | Status | Notes | Backlog |
| --- | --- | --- | --- |
| Ownership-field start | Implemented | Rule sets can use `ownership-field` start with tracked ownership values and precedence | Issues 1, 2 |
| Ownership/team event normalization | Implemented | Live Jira normalization now emits ownership and team events with source references | Issue 2 |
| Team ownership as first-class state | Implemented | Engine distinguishes owned, waiting, paused, active, and untracked intervals | Issue 4 |
| Resume rules state machine | Implemented | Configurable resume rules now gate exit from pause statuses | Issue 6 |
| Business communication pause states | Implemented | `Need More Info`-style statuses pause while ownership remains internal | Issue 7 |
| FieldMapping entity | Implemented | Field mappings are persisted and attached to rule sets in both seed and Jira-backed stores | Issue 8 |
| Dynamic field diagnostics | Implemented | Admin metadata validates mapped fields from Jira field metadata | Issue 9 |

## Milestone 2 – Customer approval readiness

| Area | Status | Notes | Backlog |
| --- | --- | --- | --- |
| Read-only scope reduction | Implemented | Manifest now uses read-only Jira scopes only | Issue 10 |
| Read-only customer approval doc | Implemented | Customer-facing access/risk document added | Issue 11 |
| Account-specific business logic template | Implemented | Template added for customer approval walkthroughs | Issue 12 |
| Sample walkthroughs | Implemented | Ownership transfer, consultant handoff, pause/resume, weekend, and P1 examples documented | Issue 13 |
| Status matrix accuracy | Implemented | This file now calls out implemented vs partial vs planned areas | Issue 21 |

## Remaining backlog snapshot

| Epic | Status | Notes |
| --- | --- | --- |
| Reliability and derived-data integrity | Planned | Persistence coordination, repair flows, and integrity checks still pending |
| Aggregate cache hardening | Partial | Aggregate types exist, but recompute/reporting cache flows still need hardening |
| Multi-clock SLA policy | Planned | Separate breach basis and clock selection are not implemented yet |
| Customer golden fixtures | Partial | Milestone 1 scenarios are covered; broader scenario catalog is still pending |
| Advanced reporting data-source clarity | Planned | Reporting fallback and aggregate/source documentation still pending |

## Deferred / not in current scope

- marketplace publication
- external warehouse synchronization
- arbitrary no-code expression builder
- predictive breach forecasting
- any Jira mutation or remediation workflow
