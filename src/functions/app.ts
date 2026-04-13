import type {
  BootstrapData,
  BusinessCalendar,
  IssueSearchFilters,
  RuleSet,
  SurfaceKind,
} from '../domain/types';
import { appStore } from '../storage/appStore';
import { explainIssueTimeline, getIssueSlaSummary } from '../rovo/actions';

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
