import Resolver from '@forge/resolver';
import { scheduledSync } from './functions/scheduledSync';
import {
  automationRecompute as _automationRecompute,
} from './functions/automationRecompute';
import {
  rovoGetIssueSummary as _rovoGetIssueSummary,
  rovoExplainIssue as _rovoExplainIssue,
  rovoListBreaches as _rovoListBreaches,
  rovoGetAssigneeMetrics as _rovoGetAssigneeMetrics,
} from './functions/rovoActions';
import {
  getIssueSummary,
  getIssueTimeline,
  getIssueAudit,
} from './functions/getIssueSla';
import { searchIssueSummaries } from './functions/searchIssueSummaries';
import { saveRuleSet, saveBusinessCalendar } from './functions/adminFunctions';
import { syncIssueHistory } from './functions/syncIssueHistory';
import {
  listRebuildJobs as listRecentRebuildJobs,
  recomputeIssueSla,
  recomputeProjectWindow,
} from './functions/rebuilds';
import {
  listRuleSets,
  listCalendars,
  getRuleSet,
  getCalendar,
  deleteRuleSet,
} from './api/storage';

// ─── UI Resolver ──────────────────────────────────────────────────────────────

const resolver = new Resolver();

// Helper to cast the never-typed payload from Forge Resolver
function p<T>(payload: never): T {
  return payload as unknown as T;
}

// Issue summary + timeline
resolver.define('getIssueSummary', async ({ payload }) => {
  return getIssueSummary(p<{ issueKey: string }>(payload).issueKey);
});

resolver.define('getIssueTimeline', async ({ payload }) => {
  return getIssueTimeline(p<{ issueKey: string }>(payload).issueKey);
});

resolver.define('getIssueAudit', async ({ payload }) => {
  return getIssueAudit(p<{ issueKey: string }>(payload).issueKey);
});

// Search / filter summaries
resolver.define('searchIssueSummaries', async ({ payload }) => {
  return searchIssueSummaries(
    p<Parameters<typeof searchIssueSummaries>[0]>(payload),
  );
});

// Manual rebuild
resolver.define('rebuildIssue', async ({ payload }) => {
  return recomputeIssueSla(
    p<{
      issueKey: string;
      ruleSetId?: string;
    }>(payload),
  );
});

resolver.define('recomputeProjectWindow', async ({ payload }) => {
  return recomputeProjectWindow(
    p<{
      projectKey: string;
      dateStart?: string;
      dateEnd?: string;
      ruleSetId?: string;
    }>(payload),
  );
});

resolver.define('listRebuildJobs', async () => {
  return listRecentRebuildJobs();
});

// Rule Sets
resolver.define('listRuleSets', async () => listRuleSets());
resolver.define('getRuleSet', async ({ payload }) =>
  getRuleSet(p<{ ruleSetId: string }>(payload).ruleSetId),
);
resolver.define('saveRuleSet', async ({ payload }) =>
  saveRuleSet(p<Parameters<typeof saveRuleSet>[0]>(payload)),
);
resolver.define('deleteRuleSet', async ({ payload }) => {
  await deleteRuleSet(p<{ ruleSetId: string }>(payload).ruleSetId);
  return { success: true };
});

// Calendars
resolver.define('listCalendars', async () => listCalendars());
resolver.define('getCalendar', async ({ payload }) =>
  getCalendar(p<{ calendarId: string }>(payload).calendarId),
);
resolver.define('saveCalendar', async ({ payload }) =>
  saveBusinessCalendar(p<Parameters<typeof saveBusinessCalendar>[0]>(payload)),
);

export const uiResolver = resolver.getDefinitions();

// ─── Scheduled Trigger ────────────────────────────────────────────────────────

export { scheduledSync };

// ─── Automation Action ────────────────────────────────────────────────────────

export const automationRecompute = _automationRecompute;

// ─── Rovo Actions ─────────────────────────────────────────────────────────────

export const rovoGetIssueSummary = _rovoGetIssueSummary;
export const rovoExplainIssue = _rovoExplainIssue;
export const rovoListBreaches = _rovoListBreaches;
export const rovoGetAssigneeMetrics = _rovoGetAssigneeMetrics;
