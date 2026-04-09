import Resolver from '@forge/resolver';
import {
  automationRecompute,
  exportCsv,
  getBootstrapData,
  getIssueSummary,
  getIssueTimeline,
  markIssueForRebuild,
  rovoListBreaches,
  runIssueRebuild,
  saveBusinessCalendar,
  saveRuleSet,
  scheduledSync,
  searchIssueSummaries,
} from './app';

const resolver = new Resolver();
const issuePayload = (payload: unknown): { issueKey: string } => payload as { issueKey: string };

resolver.define('bootstrap', async ({ payload }) => getBootstrapData(payload));
resolver.define('getIssueSummary', async ({ payload }) => getIssueSummary(issuePayload(payload).issueKey));
resolver.define('getIssueTimeline', async ({ payload }) => getIssueTimeline(issuePayload(payload).issueKey));
resolver.define('searchIssueSummaries', async ({ payload }) => searchIssueSummaries(payload ?? {}));
resolver.define('saveRuleSet', async ({ payload }) => saveRuleSet(payload));
resolver.define('saveBusinessCalendar', async ({ payload }) => saveBusinessCalendar(payload));
resolver.define('markIssueForRebuild', async ({ payload }) => markIssueForRebuild(issuePayload(payload).issueKey));
resolver.define('runIssueRebuild', async ({ payload }) => runIssueRebuild(issuePayload(payload).issueKey));
resolver.define('exportCsv', async ({ payload }) => exportCsv(payload ?? {}));

export const uiResolver = resolver.getDefinitions();
export { scheduledSync };
export { automationRecompute };
export const rovoGetIssueSummary = async ({ issueKey }: { issueKey: string }) => getIssueSummary(issueKey);
export const rovoExplainIssue = async ({ issueKey }: { issueKey: string }) => getIssueTimeline(issueKey);
export { rovoListBreaches };
