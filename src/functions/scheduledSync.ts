import { searchIssues } from '../api/jira';
import { appStore } from '../storage/appStore';

/**
 * Scheduled trigger handler.  Iterates over all rule sets and recomputes SLA
 * summaries for recently updated issues.
 */
export async function scheduledSync(): Promise<void> {
  const ruleSets = await appStore.listRuleSets();

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
          await appStore.recomputeIssue(issue.key, 'scheduled');
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
