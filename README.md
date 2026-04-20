# Jira-SLA

Forge-native Jira SLA tracking app that reconstructs Jira issue history into
deterministic SLA segments and exposes the precomputed results through project,
issue, dashboard, admin, automation, and Rovo-ready surfaces.

## Installation

See the installation guides:

- [docs/installation-guide.md](docs/installation-guide.md)
- [docs/customer-installation-guide.md](docs/customer-installation-guide.md)
- [docs/sla-business-logic.md](docs/sla-business-logic.md)

## App surfaces

- **Jira project page** – KPI cards, issue explorer, assignee analytics, rule
  set administration, calendars, and rebuild activity
- **Jira issue panel** – per-ticket SLA state, response/active/paused metrics,
  breach status, and segment timeline explanation
- **Jira dashboard gadget** – rollup metrics by priority and assignee
- **Scheduled trigger + automation action** – recompute summaries from Jira
  changelog updates
- **Rovo agent + actions** – query precomputed SLA summaries conversationally

## Local validation

From the repository root:

```bash
npm install
npm test
npm run build
```

The repository uses seeded Jira-like fixtures so the app can be built and
validated locally without a live Jira tenant. Replace the in-memory store with
Forge storage bindings when wiring the app into a deployed Forge environment.

## Runtime configuration

- Deployed Forge environments now default to a Jira-backed store that fetches
  live issues, assignable users, project statuses, and team options.
- Set `TEAM_FIELD_KEY` to the Jira custom field ID/key used to store team
  ownership, for example `customfield_12345`.
- Set `USE_SEED_DATA=true` when you explicitly want the seeded in-memory store
  instead of live Jira data, such as local development or troubleshooting.

## UI screenshots

### Project page – SLA Analytics

![Project page screenshot](docs/screenshots/project-page.png)

### Issue panel – per-ticket SLA breakdown

![Issue panel screenshot](docs/screenshots/issue-panel.png)

### Dashboard gadget – SLA rollups

![Dashboard gadget screenshot](docs/screenshots/dashboard-gadget.png)
