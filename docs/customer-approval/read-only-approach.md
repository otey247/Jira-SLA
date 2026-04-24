# Read-Only Architecture and Access Posture

## Purpose

This document gives customer stakeholders a short approval artifact for the
Jira-SLA app before credentials or installation approval are shared.

## What the app reads from Jira

The app reads Jira data that is needed to reconstruct SLA history and display
reports:

- issue metadata
- issue changelog history
- issue worklogs for audit comparison
- Jira projects
- project statuses
- assignable users
- Jira field metadata

## What the app stores

The app stores derived and administrative data in Forge storage only:

- rule sets
- business calendars
- field mappings
- normalized issue snapshots
- SLA segments
- issue summaries
- rebuild jobs and checkpoints

## What the app does not write to Jira

The app does **not** perform Jira mutation.

Specifically, it does not:

- update Jira fields
- transition issues
- add comments
- write worklogs
- change assignments
- alter priorities or resolutions

## Jira scopes required

- `read:jira-work` – read issues, changelogs, worklogs, projects, statuses, and fields
- `read:jira-user` – read assignable-user metadata for admin selectors and reporting labels
- `storage:app` – persist derived SLA data and admin configuration in Forge storage

The repository no longer requests `write:jira-work` because Milestone 2 audited
all Jira API usage and confirmed the deployed app behavior is read-only.

## Data-flow summary

1. Read issue and changelog history from Jira.
2. Normalize Jira field changes into deterministic SLA events.
3. Recompute segments and summary metrics inside the app.
4. Store the derived results in Forge storage.
5. Serve dashboards, SLA breakdowns, and explanations from the stored derived data.

## Customer review notes

Customers should expect the app to request access to read Jira work and user
metadata, but not to modify Jira records. Any customer-specific ownership field
or responsible-organization field is configured as a read-only mapping.
