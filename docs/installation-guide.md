# Jira SLA Tracker Installation Guide

This guide explains how to install the Jira SLA Tracker Forge app into a Jira
Cloud site and complete the first-time configuration.

## What this app installs

After installation, the app provides:

- **Project page**: `SLA Analytics`
- **Issue panel**: `SLA Breakdown`
- **Dashboard gadget**: `SLA Metrics`
- **Scheduled sync**: recalculates SLA summaries every 5 minutes
- **Automation action**: `Recompute SLA Summary`

## Prerequisites

Before you begin, make sure you have:

1. **A Jira Cloud site** where the app will be installed.
2. **Site admin access** to that Jira Cloud site.
3. **An Atlassian account** that can use Forge.
4. **Node.js and npm** installed locally.
5. **Forge CLI** installed:

   ```bash
   npm install -g @forge/cli
   ```

6. A local clone of this repository.

## Access you need from the customer

If you are installing this for a client, you need:

- Access to the **customer Jira Cloud site**
- A **site admin** who can approve and install the app
- Access to the Jira projects the SLA rules will cover
- Agreement on:
  - tracked project keys
  - active, paused, and stopped statuses
  - business hours and timezone
  - holiday dates
  - SLA targets by priority

## Step 1: Open the repository

From the repository root, install dependencies:

```bash
npm install
```

Optional local validation:

```bash
npm run build
npm test -- --runInBand
npm run lint
```

## Step 2: Authenticate Forge CLI

Log in to Forge:

```bash
forge login
```

Verify the active account:

```bash
forge whoami
```

## Step 3: Register the app under your Atlassian account

This repository already contains an `app.id` in `manifest.yml`.

If that app is not owned by your Atlassian account, register your own copy
before deploying:

```bash
forge register
```

This updates the app registration so you can deploy and manage it from your own
Forge account.

## Step 4: Deploy the app

Deploy the app to the Forge development environment:

```bash
forge deploy
```

If you want to deploy to another environment, specify it explicitly, for
example:

```bash
forge deploy -e staging
forge deploy -e production
```

## Step 5: Install the app into Jira

Install the app into the target Jira Cloud site:

```bash
forge install --site <your-site>.atlassian.net --product jira
```

Example:

```bash
forge install --site example-client.atlassian.net --product jira
```

During installation:

1. Select the environment you deployed.
2. Confirm the site URL.
3. Review the permissions requested by the app.
4. Approve the installation as a Jira site admin.

## App permissions requested

The app requests these Jira scopes from `manifest.yml`:

- `read:jira-work`
- `read:jira-user`
- `write:jira-work`

These permissions allow the app to read Jira issues and users, recompute SLA
data, and expose the Jira integrations configured in the app.

## Step 6: Confirm the app appears in Jira

After installation, confirm each surface is available.

### Project page: SLA Analytics

Open a Jira project and look for the **SLA Analytics** project page.

![Project page screenshot](screenshots/project-page.png)

### Issue panel: SLA Breakdown

Open an issue in one of the tracked projects and confirm the **SLA Breakdown**
panel is visible.

![Issue panel screenshot](screenshots/issue-panel.png)

### Dashboard gadget: SLA Metrics

Open a Jira dashboard and add the **SLA Metrics** gadget.

![Dashboard gadget screenshot](screenshots/dashboard-gadget.png)

## Step 7: Configure the app after installation

The app is installed at this point, but it will not produce useful SLA results
until you configure a calendar and at least one rule set.

### 7.1 Create a business calendar

In **SLA Analytics**, open the **Calendars** tab and create a business
calendar with:

- name
- timezone
- working days
- working hours start and end
- holiday dates
- after-hours mode

### 7.2 Create a rule set

Open the **Rule Sets** tab and create at least one rule set with:

- name
- project keys
- team IDs, if used
- tracked assignee account IDs, if used
- active statuses
- paused statuses
- stopped statuses
- start mode
- linked business calendar
- priority overrides JSON for SLA targets

### 7.3 Recompute or wait for the scheduled sync

The app includes a scheduled trigger that runs every 5 minutes. You can either:

- wait for the scheduled sync to process recently updated issues, or
- use the **Rebuild Jobs** tab to manually recompute a specific issue

## Step 8: Validate the installation

Use this checklist after setup:

- The project page opens without errors
- At least one calendar exists
- At least one rule set exists
- A tracked issue shows SLA data in the issue panel
- The dashboard gadget can be added successfully
- Manual rebuild works for a known issue key

## Updating the installation

When you change the app code later:

```bash
forge deploy
forge install --upgrade --site <your-site>.atlassian.net --product jira
```

## Troubleshooting

### `forge deploy` fails because of app ownership

Run:

```bash
forge register
```

Then deploy again.

### The app installs but no SLA data appears

Check the following:

- the Jira project key is included in a rule set
- the rule set is linked to a business calendar
- the issue has changelog/history available in Jira
- the issue panel is being tested against a project covered by the rule set

### The issue panel says there is no SLA data yet

Use the **Rebuild Jobs** tab or wait for the next scheduled sync.

### The dashboard gadget is missing

Confirm the app was installed into Jira successfully and refresh the dashboard
add-gadget dialog after installation.
