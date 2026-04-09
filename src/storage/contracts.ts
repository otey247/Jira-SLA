import type {
  BootstrapData,
  BusinessCalendar,
  IssueCheckpoint,
  IssueSearchFilters,
  IssueSegment,
  IssueSnapshot,
  IssueSummary,
  RebuildJob,
  RuleSet,
  SurfaceKind,
} from '../domain/types';

export interface ApplicationStore {
  listRuleSets(): Promise<RuleSet[]>;
  listCalendars(): Promise<BusinessCalendar[]>;
  listRebuildJobs(): Promise<RebuildJob[]>;
  getIssueSnapshot(issueKey: string): Promise<IssueSnapshot | undefined>;
  getIssueSummary(issueKey: string): Promise<IssueSummary | undefined>;
  getIssueSegments(issueKey: string): Promise<IssueSegment[]>;
  listIssueSummaries(filters?: IssueSearchFilters): Promise<IssueSummary[]>;
  saveRuleSet(ruleSet: RuleSet): Promise<RuleSet>;
  saveCalendar(calendar: BusinessCalendar): Promise<BusinessCalendar>;
  markIssueForRebuild(issueKey: string): Promise<RebuildJob>;
  recomputeIssue(issueKey: string, source: RebuildJob['source']): Promise<IssueSummary>;
  recomputePendingIssues(limit?: number): Promise<IssueSummary[]>;
  getCheckpoint(issueKey: string): Promise<IssueCheckpoint | undefined>;
  getBootstrapData(surface: SurfaceKind, issueKey?: string): Promise<BootstrapData>;
  exportCsv(filters?: IssueSearchFilters): Promise<string>;
}
