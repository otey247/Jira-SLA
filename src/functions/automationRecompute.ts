import { syncIssueHistory } from './syncIssueHistory';
import { listRuleSets } from '../api/storage';

interface AutomationPayload {
  issueKey?: string;
  issue?: { key: string };
}

/**
 * Automation action handler.  Can be triggered from a Jira Automation rule to
 * recompute the SLA summary for the current issue.
 */
export async function automationRecompute(
  payload: AutomationPayload,
): Promise<{ success: boolean; message: string }> {
  const issueKey = payload?.issueKey ?? payload?.issue?.key;

  if (!issueKey) {
    return { success: false, message: 'No issue key provided in payload.' };
  }

  // Find the first matching rule set for this issue
  const ruleSets = await listRuleSets();
  const ruleSet = ruleSets.find((rs) => {
    const projectKey = issueKey.split('-')[0];
    return rs.projectKeys.includes(projectKey) || rs.projectKeys.length === 0;
  });

  if (!ruleSet) {
    return {
      success: false,
      message: `No rule set found for issue ${issueKey}.`,
    };
  }

  try {
    await syncIssueHistory({
      issueKey,
      ruleSetId: ruleSet.ruleSetId,
      forceRebuild: true,
    });
    return { success: true, message: `SLA recomputed for ${issueKey}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}
