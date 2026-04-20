# Jira SLA Tracker Customer Installation Guide

This guide is for Jira admins who want to install the app without working
through the full technical Forge setup document.

For the technical version, see [`installation-guide.md`](installation-guide.md).

## Before you start

Make sure you have:

- a **Jira Cloud** site
- **site admin** access
- the app package/repository owner available to run the Forge deployment
- the Jira projects you want to track

## What you will see after installation

The app adds three main Jira surfaces:

1. **SLA Analytics** project page
2. **SLA Breakdown** issue panel
3. **SLA Metrics** dashboard gadget

### Project page

![Project page screenshot](screenshots/project-page.png)

### Issue panel

![Issue panel screenshot](screenshots/issue-panel.png)

### Dashboard gadget

![Dashboard gadget screenshot](screenshots/dashboard-gadget.png)

## Installation steps

### 1. Ask the technical owner to deploy the app

The repository owner or technical installer needs to deploy the Forge app before
you can install it into Jira.

If you are that person, use the full technical guide:

- [Technical installation guide](installation-guide.md)

### 2. Install the app into your Jira site

Once the app has been deployed, install it into your Jira Cloud site.

The technical installer will run a command similar to:

```bash
forge install --site <your-site>.atlassian.net --product jira
```

As the Jira admin, you will need to:

- confirm the target Jira site
- review the requested app permissions
- approve the installation

## First-time setup in Jira

After installation, open the app and complete these setup steps.

### 1. Open the SLA Analytics project page

Go to a Jira project and open **SLA Analytics** from the project navigation.

Use this page to manage the app configuration.

### 2. Create a business calendar

In the **Calendars** tab, create a calendar that defines:

- timezone
- working days
- working hours
- holidays

This tells the app when SLA time should count.

### 3. Create a rule set

In the **Rule Sets** tab, create at least one rule set for the projects you want
to track.

You will usually need to define:

- Jira project keys
- active statuses
- paused statuses
- stopped or completed statuses
- SLA target times by priority
- the business calendar to use

### 4. Wait for sync or run a rebuild

The app recalculates data automatically on a schedule.

If you want to check results right away, use the **Rebuild Jobs** area to
recompute a known issue.

## How to confirm the app is working

Use this checklist:

- the **SLA Analytics** page opens
- the **Calendars** tab has at least one calendar
- the **Rule Sets** tab has at least one rule set
- a Jira issue shows the **SLA Breakdown** panel
- a Jira dashboard can add the **SLA Metrics** gadget

## What to do if something is missing

### The app is installed but no SLA data appears

Check that:

- the issue belongs to a tracked project
- the project is included in a rule set
- the rule set is linked to a calendar
- the issue has enough history/changelog data in Jira

### The issue panel does not show data yet

Wait for the scheduled sync or run a manual rebuild.

### The dashboard gadget is not visible

Refresh the Jira dashboard page and open the add-gadget dialog again.

## Need more detail?

Use the full guide for deployment, registration, permissions, and troubleshooting:

- [Technical installation guide](installation-guide.md)
- [SLA business logic guide](sla-business-logic.md)
