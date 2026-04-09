# Jira-SLA

Forge-based Jira SLA tracking application that reconstructs issue timelines, computes deterministic SLA metrics, and exposes project, issue, dashboard, admin, automation, and Rovo-ready surfaces.

## What is included

- Atlassian Forge manifest with Jira project page, issue panel, dashboard gadget, scheduled trigger, automation action, and Rovo action scaffolding
- Deterministic TypeScript SLA engine for assignment, pause/resume, business-hours, and priority override logic
- In-memory application store seeded with representative Jira issue fixtures for local development and tests
- React Custom UI surface that renders project analytics, issue explainability, admin forms, and export/rebuild actions
- Vitest coverage for the core engine and rebuild pipeline

## Local development

```bash
npm install
npm test
npm run build
```

The repository uses seeded Jira-like fixtures so the app can be built and validated locally without a live Jira tenant. Replace the in-memory store with Forge storage bindings when wiring the app into a deployed Forge environment.
