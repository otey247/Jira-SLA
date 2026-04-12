import { syncIssueHistory } from './syncIssueHistory';
import { listRuleSets } from '../api/storage';
import { searchIssues } from '../api/jira';

/**
 * Scheduled trigger handler.  Iterates over all rule sets and recomputes SLA
 * summaries for recently updated issues.
 */
export async function scheduledSync(): Promise<void> {
  const ruleSets = await listRuleSets();

  for (const ruleSet of ruleSets) {
    for (const projectKey of ruleSet.projectKeys) {
      // Find issues updated in the last 10 minutes to limit API load
      const jql = `project = "${projectKey}" AND updated >= -10m ORDER BY updated ASC`;
      let issues: Awaited<ReturnType<typeof searchIssues>>;

      try {
        issues = await searchIssues(jql);
      } catch (err) {
        console.error(
          `[scheduledSync] JQL failed for project ${projectKey}:`,
          err,
        );
        continue;
      }

      for (const issue of issues) {
        try {
          await syncIssueHistory({
            issueKey: issue.key,
            ruleSetId: ruleSet.ruleSetId,
          });
        } catch (err) {
          console.error(
            `[scheduledSync] Failed to sync ${issue.key}:`,
            err,
          );
        }
      }
    }
  }
}
