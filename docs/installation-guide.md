# Jira SLA Tracker Installation Guide

This guide explains how to install the Jira SLA Tracker Forge app into a Jira
Cloud site and complete the first-time configuration.

If you need a shorter version for non-technical Jira admins, see
[`customer-installation-guide.md`](customer-installation-guide.md).

## What this app installs

After installation, the app provides:

- **Project page**: `SLA Analytics`
- **Issue panel**: `SLA Breakdown`
- **Dashboard gadget**: `SLA Metrics`
- **Scheduled sync**: recalculates SLA summaries every 5 minutes
- **Rovo agent**: `SLA Analyst`

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
npm test
npm run build
```

## Step 2: Authenticate Forge CLI

Choose one authentication method.

### Option A: Use the local keychain

Log in to Forge:

```bash
forge login
```

Verify the active account:

```bash
forge whoami
```

### Option B: Use environment variables

If you are running in WSL, CI, or any environment where the local keychain is
not available, export these variables instead:

```bash
export FORGE_EMAIL="you@example.com"
export FORGE_API_TOKEN="your-atlassian-api-token"
forge whoami
```

Important notes:

- The Forge CLI expects `FORGE_API_TOKEN`, not `FORGE_CLI_TOKEN`.
- If you use `FORGE_EMAIL` and `FORGE_API_TOKEN`, you do not need to run
  `forge login`.
- A `.env` file is not loaded automatically by the Forge CLI. If you keep local
  credentials in a shell file, load it into your current shell before running
  Forge commands.
- Shell-style env files should use `KEY=value` with no spaces around `=`.

Example shell file:

```bash
FORGE_EMAIL=you@example.com
FORGE_API_TOKEN=your-atlassian-api-token
```

Then load it in bash or WSL:

```bash
set -a
source .env.local
set +a
forge whoami
```

## Step 3: Register the app under your Atlassian account

Run:

```bash
forge register
```

If you are starting from a fresh clone, Forge may first tell you that you are
not yet a member of a Developer Space. That is expected. The CLI will walk you
through creating one if needed.

Typical first-time prompts look like this:

1. Forge checks whether you already belong to a Developer Space.
2. If you do not, it asks you to create one.
3. It asks for the app name.
4. It asks you to accept the Atlassian Developer Terms.
5. It registers the app and creates `development`, `staging`, and `production`
   environments.

Example flow:

```text
You are not currently a member of a Developer Space...
? Enter a name for your Developer Space: AIJumpStartJira
✔ A Developer Space has been created for you.

Registering the app to you.
? Enter a name for your app: JIRA-SLA
? Do you accept? Yes
✔ Registered JIRA-SLA

Your app is ready to work on, deploy, and install.
We created 3 environments you can deploy to: production, staging, development.
```

What `forge register` does in this repo:

- associates the app with your Atlassian account and Developer Space
- writes your app ID into [manifest.yml]
- prepares the default Forge environments you will deploy to next

Important notes:

- You do not need to keep exporting `APP_ID` after registration in the current
  version of this repo because the app ID is now written directly into
  `manifest.yml`.
- If you are following older notes that mention
  `ari:cloud:ecosystem::app/${APP_ID}`, those apply to an earlier manifest
  pattern, not the current checked-in manifest.
- If you want each developer to keep their own app ID without editing
  `manifest.yml`, revert to the environment-variable pattern intentionally
  rather than mixing both approaches.

## Step 4: Deploy the app

Deploy the app to the Forge development environment:

```bash
forge deploy
```

What happens next:

1. Forge deploys to the `development` environment by default.
2. The CLI runs `forge lint` before uploading anything.
3. If lint succeeds, Forge bundles the app and uploads it.
4. After a successful deploy, you install the app into a Jira site with
   `forge install`.

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

### `forge whoami` says `Not logged in`

If you are not using `forge login`, export the correct variables and retry:

```bash
export FORGE_EMAIL="you@example.com"
export FORGE_API_TOKEN="your-atlassian-api-token"
forge whoami
```

If you are loading values from a file, make sure the file uses `KEY=value`
syntax and that you sourced it into the current shell session.

### `forge deploy` fails with a `--moduleResolution` error

Update [tsconfig.json] so the root
compiler options use:

```json
"moduleResolution": "node"
```

Then rerun:

```bash
forge deploy
```

### `forge deploy` fails because ESLint says a file is not included in `tsconfig.json`

If Forge reports an error like this:

```text
ESLint was configured to run on <tsconfigRootDir>/src/__tests__/calendar.test.ts
However, that TSConfig does not include this file.
```

make sure the root [tsconfig.json] does
not exclude files that Forge lint may type-check, including `src/__tests__`,
`src/__mocks__`, and repo-level test files such as `tests/**/*.ts`.

In this repo, the root `tsconfig.json` should include:

```json
"include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "vite.config.ts"]
```

and should not exclude those test or mock folders.

Then rerun:

```bash
forge deploy
```

### `forge deploy` says it could not find `APP_ID`

That usually means you are using an older manifest template that still resolves
the app ID from `APP_ID`. The current version of this repo writes the app ID
directly into `manifest.yml` during `forge register`, so you should not need
`APP_ID` unless you intentionally switched back to the placeholder pattern.

### The app installs but no SLA data appears

Check that:

- at least one business calendar exists
- at least one rule set is configured
- tracked project keys match the Jira projects you expect
- tracked statuses match the workflow states in Jira
- the scheduled trigger has had time to process updated issues
