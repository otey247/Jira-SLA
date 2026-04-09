import type {
  BootstrapData,
  BusinessCalendar,
  IssueSearchFilters,
  RuleSet,
  SurfaceKind,
} from '../domain/types';
import { appStore } from '../storage/appStore';
import { explainIssueTimeline, getIssueSlaSummary, listBreachedIssues } from '../rovo/actions';

export const getBootstrapData = async ({ surface, issueKey }: { surface: SurfaceKind; issueKey?: string }): Promise<BootstrapData> => {
  return appStore.getBootstrapData(surface, issueKey);
};

export const getIssueSummary = async (issueKey: string) => getIssueSlaSummary(issueKey);
export const getIssueTimeline = async (issueKey: string) => explainIssueTimeline(issueKey);
export const searchIssueSummaries = async (filters: IssueSearchFilters) => appStore.listIssueSummaries(filters);
export const saveRuleSet = async (ruleSet: RuleSet) => appStore.saveRuleSet(ruleSet);
export const saveBusinessCalendar = async (calendar: BusinessCalendar) => appStore.saveCalendar(calendar);
export const markIssueForRebuild = async (issueKey: string) => appStore.markIssueForRebuild(issueKey);
export const runIssueRebuild = async (issueKey: string) => appStore.recomputeIssue(issueKey, 'manual');
export const exportCsv = async (filters: IssueSearchFilters) => appStore.exportCsv(filters);
export const scheduledSync = async () => appStore.recomputePendingIssues();
export const automationRecompute = async (payload: { issueKey?: string; projectKey?: string }) => {
  if (payload.issueKey) {
    return appStore.recomputeIssue(payload.issueKey, 'automation');
  }
  const summaries = await appStore.listIssueSummaries({ projectKey: payload.projectKey });
  return Promise.all(summaries.map((summary) => appStore.recomputeIssue(summary.issueKey, 'automation')));
};
export const rovoListBreaches = async () => listBreachedIssues();
