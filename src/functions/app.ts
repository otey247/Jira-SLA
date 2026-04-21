import type {
  AdminMetadata,
  BootstrapData,
  BootstrapRequest,
  BusinessCalendar,
  FieldMapping,
  IssueSearchFilters,
  RuleSet,
} from '../domain/types';
import { appStore } from '../storage/appStore';
import { explainIssueTimeline, getIssueSlaSummary } from '../rovo/actions';

export const getBootstrapData = async (request: BootstrapRequest): Promise<BootstrapData> => {
  return appStore.getBootstrapData(request);
};

export const getIssueSummary = async (issueKey: string) => getIssueSlaSummary(issueKey);
export const getIssueTimeline = async (issueKey: string) => explainIssueTimeline(issueKey);
export const searchIssueSummaries = async (filters: IssueSearchFilters) => appStore.listIssueSummaries(filters);
export const saveRuleSet = async (ruleSet: RuleSet) => appStore.saveRuleSet(ruleSet);
export const saveFieldMapping = async (fieldMapping: FieldMapping) => appStore.saveFieldMapping(fieldMapping);
export const saveBusinessCalendar = async (calendar: BusinessCalendar) => appStore.saveCalendar(calendar);
export const getAdminMetadata = async (projectKeys?: string[]): Promise<AdminMetadata> => appStore.getAdminMetadata(projectKeys);
export const markIssueForRebuild = async (issueKey: string) => appStore.markIssueForRebuild(issueKey);
export const runIssueRebuild = async (issueKey: string) => appStore.recomputeIssue(issueKey, 'manual');
export const getIssueIntegrityReport = async (issueKey: string) => appStore.getIssueIntegrityReport(issueKey);
export const repairIssueDerivedData = async (issueKey: string) => appStore.repairIssueDerivedData(issueKey);
export const exportCsv = async (filters: IssueSearchFilters) => appStore.exportCsv(filters);
