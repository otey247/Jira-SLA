# Jira-SLA

Forge-native Jira SLA tracking app that uses Jira issue history as the source of
truth, computes deterministic SLA segments in app code, and exposes the
precomputed results through Custom UI surfaces and Rovo actions.

## Installation

See the installation guides:

- [docs/installation-guide.md](docs/installation-guide.md)
- [docs/customer-installation-guide.md](docs/customer-installation-guide.md)

## App surfaces

- **Jira project page** – KPI cards, issue explorer, assignee analytics, rule
  set administration, calendars, and manual rebuild jobs
- **Jira issue panel** – per-ticket SLA state, response/active/paused metrics,
  breach warning, and segment timeline
- **Jira dashboard gadget** – rollup metrics by priority and assignee
- **Scheduled trigger + automation action** – recompute summaries from Jira
  changelog updates
- **Rovo agent + actions** – query precomputed SLA summaries conversationally

## Local validation

From the repository root:

```bash
npm install
npm run build
npm test -- --runInBand
npm run lint
```

## UI screenshots

### Project page – SLA Analytics

![Project page screenshot](docs/screenshots/project-page.png)

### Issue panel – per-ticket SLA breakdown

![Issue panel screenshot](docs/screenshots/issue-panel.png)

### Dashboard gadget – SLA rollups

![Dashboard gadget screenshot](docs/screenshots/dashboard-gadget.png)
