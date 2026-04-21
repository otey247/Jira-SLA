import type {
  AdminMetadata,
  BootstrapData,
  BootstrapRequest,
  BusinessCalendar,
  FieldMapping,
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
  listFieldMappings(): Promise<FieldMapping[]>;
  listCalendars(): Promise<BusinessCalendar[]>;
  listRebuildJobs(): Promise<RebuildJob[]>;
  getIssueSnapshot(issueKey: string): Promise<IssueSnapshot | undefined>;
  getIssueSummary(issueKey: string): Promise<IssueSummary | undefined>;
  getIssueSegments(issueKey: string): Promise<IssueSegment[]>;
  listIssueSummaries(filters?: IssueSearchFilters): Promise<IssueSummary[]>;
  saveRuleSet(ruleSet: RuleSet): Promise<RuleSet>;
  saveFieldMapping(fieldMapping: FieldMapping): Promise<FieldMapping>;
  saveCalendar(calendar: BusinessCalendar): Promise<BusinessCalendar>;
  markIssueForRebuild(issueKey: string): Promise<RebuildJob>;
  recomputeIssue(issueKey: string, source: RebuildJob['source']): Promise<IssueSummary>;
  recomputePendingIssues(limit?: number): Promise<IssueSummary[]>;
  getCheckpoint(issueKey: string): Promise<IssueCheckpoint | undefined>;
  getBootstrapData(request: BootstrapRequest): Promise<BootstrapData>;
  getAdminMetadata(projectKeys?: string[]): Promise<AdminMetadata>;
  exportCsv(filters?: IssueSearchFilters): Promise<string>;
}
